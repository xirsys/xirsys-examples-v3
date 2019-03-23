import argparse
import asyncio
import logging, json, threading, sys
import requests, websockets

from enum import Enum

from aiortc import RTCPeerConnection, RTCSessionDescription, RTCConfiguration, RTCIceServer
from aiortc.sdp import candidate_from_sdp, candidate_to_sdp

logger = logging.getLogger('xirsysapp')

class PeerConnection():

    class PcState(Enum):
        ICE_READY = 1
        ICE_NOT_READY = 2
        ICING = 3
        CONNECTING = 4
        CONNECTED = 5
        DISCONNECTED = 6
        TERMINATED = 7

    def __init__(self, user_name, xirsys_url):
        self._user = user_name
        self._xirsys_url = xirsys_url
        self._state = self.PcState.ICE_NOT_READY

        self._wsurl = None
        self._socket = None
        self._ice_state = None
        self._channel = None

    @property
    def state(self):
        return self._state
    
    @state.setter
    def state(self, value):
        logger.debug('state changed from {} to {}'.format(self._state, value))
        self._state = value

    def doIce(self):
        
        # 1. get ice servers
        url = "{}/getice.php".format(self._xirsys_url)
        r = requests.post(url, verify=False)
        ice_servers = r.json()['v']
        logger.debug('successfully retrieved ice hosts: \t{}'.format(ice_servers))

        # 2. getting a temp token
        url = "{}/gettoken.php".format(self._xirsys_url)
        r = requests.post(url, verify=False, data={'username': self._user})
        token = r.json()['v']
        logger.debug('successfully retrieved a token: \t{}'.format(token))

        # 3. getting a host
        url = "{}/gethost.php".format(self._xirsys_url)
        r = requests.post(url, verify=False, data={'username': self._user})
        wshost = r.json()['v']
        logger.debug('successfuly retrieved a host: \t{}'.format(wshost))

        # 4. peer connection
        self._wsurl = '{}/v2/{}'.format(wshost, token)
        config = self.generate_rtc_configuration(ice_servers)
        self._pc = RTCPeerConnection(config);

        # change the state
        self.state = self.PcState.ICE_READY

    def generate_rtc_configuration(self, ice_servers):

        rtc_ice_servers = []

        # url should be urls according the spec
        # https://www.w3.org/TR/webrtc/#dom-rtciceserver
        for ice_server in ice_servers['iceServers']:

            # copy to a property urls as a list
            ice_server['urls'] = [ice_server['url']]
            del ice_server['url']

            rtc_ice_server = RTCIceServer(**ice_server)
            logger.debug('adding an ice server:\t{}'.format(rtc_ice_server))

            rtc_ice_servers.append(rtc_ice_server)

        return RTCConfiguration(rtc_ice_servers)

    @property
    def wsurl(self):
        return self._wsurl

    async def run(self):

        while not self._state == self.PcState.TERMINATED:

            try:

                if self._state == self.PcState.ICE_NOT_READY:
                    self.doIce()

                #1. wait for a message over signaling
                logger.info('starting signaling...')
                await self.keep_signaling()

                #2. once established, keep data channel open
                logger.info('starting data channel...')
                await self.keep_datachannel()

            except KeyboardInterrupt:

                logger.info('detected Ctrl+C, terminating...')
                self.state = self.PcState.TERMINATED

            except Exception:

                logger.exception('an unhandled exception, terminating...')
                self.state = self.PcState.TERMINATED

            finally:
                #3. cleanup, and set ready
                if not await self.cleanup():
                    logger.error('cleanup failed, terminating...')
                    break

    async def keep_signaling(self):

        logger.debug('the websocket url for the signaling is: \t{}'.format(self._wsurl))

        logger.debug('connecting...')
        async with websockets.client.connect(self._wsurl) as websocket:

            while not self._state == self.PcState.TERMINATED and websocket.open:

                try:

                    message = await asyncio.wait_for(websocket.recv(), 1.0)

                    logger.debug('received message over websocket: \t{}'.format(message))

                    data = json.loads(message)
                    msg_objective = data['m']['o']

                    if msg_objective == 'peers':

                        logger.debug('received peers notification')

                    elif msg_objective == 'peer_connected':

                        logger.debug('received a peer connected')
                        joined = data['m']['f'].split('/')[-1];
                        logger.info('{} joined'.format(joined))

                        if joined != self._user:

                            self.state = self.PcState.ICING

                            # call this peer
                            await self.call_peer(websocket, joined)

                    elif msg_objective == 'peer_removed':

                        left = data['m']['f'].split('/')[-1];
                        logger.info('{} has left'.format(left))

                    elif msg_objective == 'message':

                        msg_type = data['p']['msg']['type']

                        if msg_type == 'offer':

                            logger.info('received an offer')
                            self.state = self.PcState.ICING
                            await self.make_answer(websocket, data)

                        elif msg_type == 'answer':

                            logger.info('received an answer')

                            await self.accept_answer(data)

                        elif msg_type == 'candidate':

                            message = data['p']['msg']
                            logger.debug('received a candidate\t{}'.format(message))
                            candidate = candidate_from_sdp(message['candidate'].split(':', 1)[1])
                            candidate.sdpMid = message['sdpMid']
                            candidate.spdMLineIndex = message['sdpMLineIndex']
                            logger.debug('adding a candidate:\t{}'.format(candidate))
                            self._pc.addIceCandidate(candidate)

                        else:

                            logger.warn('unknown message type: {}'.format(msg_type))

                    else:

                        logger.warning('unknown message objective: {}'.format(msg_objective))

                except asyncio.TimeoutError:
                    logger.debug('regular timeout occured...')

                    if self._state == self.PcState.CONNECTING:
                        logger.debug('ice got completed, closing the websocket connection...')
                        await websocket.close()
                        logger.debug('closed the websocket connection')

                except websockets.exceptions.ConnectionClosed:
                    logger.error('websocket connection closed')

        logging.debug('finished signaling')

    async def keep_datachannel(self):

        # wait for a while until connection is established
        waited = 0
        while self._state == self.PcState.CONNECTING and waited < 10:
            if self._channel.readyState == 'open':
                self.state = self.PcState.CONNECTED
            else:
                logger.debug('waiting for a data connection is established, the current channel state = {}...'.format(self._channel.readyState))
                await asyncio.sleep(1)
            waited += 1

        if waited == 10:
            raise Exception('failed to establish a data connection')

        if not self._state == self.PcState.CONNECTED:
            logger.error('a channel is not opened yet, nothing to do')
            return

        @self._channel.on('message')
        def on_message(message):
            logger.debug('message arrived:\t{}'.format(message))
            try:
                js_message = json.loads(message)
                message_from = js_message['f']
                message_text = js_message['msg']
                logger.info('({})<<===({}) \t{}'.format(self._user, message_from, message_text))
                echo = {'f': self._user, 'msg': message_text}
                self._channel.send(json.dumps(echo))
                logger.info('({})===({})>> \t{}'.format(self._user, message_from, message_text))
            except Exception as e:
                logger.exception('failed at a message handling')
        
        while self._state == self.PcState.CONNECTED:

            try:

                logger.debug('the current state of the rtcs transport = {}'.format(self._channel.transport.state))
                logger.debug('the current state of the dtls transport = {}'.format(self._channel.transport.transport.state))

                # TODO: disconnect the remote peer after a data exchange, then this won't get triggered
                if self._channel.transport.transport.state == 'closed':
                    self.state = self.PcState.DISCONNECTED
                    logger.debug('current state = {}'.format(self._state))
                else:
                    await asyncio.sleep(1)

            except Exception as e:
                logger.exception('an handled exception at keeping a data channel')
                raise e

    async def send_message(self, websocket, message):
        logger.debug('sending the following message over websocket: \t{}'.format(message))
        await websocket.send(message)

    async def call_peer(self, websocket, peer):

        logger.info('calling {}...'.format(peer))
        self._channel = self._pc.createDataChannel('data')
        logger.debug('created a datachannel')

        self.setup_iceevents()

        # create an offer, and set local
        logger.debug('creating an offer, and setting as a local description')
        await self._pc.setLocalDescription(await self._pc.createOffer())

        # send via signaling
        logger.debug('sending an offer...')
        js_desc = {
            'sdp': self._pc.localDescription.sdp,
            'type': self._pc.localDescription.type
        }
        js_offer = {'t': 'u', 'm': {'f': "SampleAppChannel/{}".format(self._user), 'o': 'message', 't': peer}, 'p': {'msg':js_desc}};
        await self.send_message(websocket, json.dumps(js_offer))

    async def make_answer(self, websocket, data):

        peer = data['m']['f'].split('/')[-1];
        logger.info('making an answer to {}'.format(peer))

        # datachannel event is emitted inside setRemoteDescription
        @self._pc.on('datachannel')
        def on_datachannel(channel):

            logger.debug('on datachannel')
            self._channel = channel

        logger.debug('setting a remote description...')
        remote_desc = RTCSessionDescription(**data['p']['msg']);
        await self._pc.setRemoteDescription(remote_desc)

        self.setup_iceevents()

        # create offer
        logger.debug('creating offer, and then setting as a local description...')
        local_desc = await self._pc.createAnswer()
        await self._pc.setLocalDescription(local_desc)
        
        # send an answer
        logger.debug('sending an answer...')
        js_desc = {
            'sdp': self._pc.localDescription.sdp,
            'type': self._pc.localDescription.type
        }
        js_answer = {'t': 'u', 'm': {'f': "SampleAppChannel/{}".format(self._user), 'o': 'message', 't': peer}, 'p': {'msg':js_desc}};
        await self.send_message(websocket, json.dumps(js_answer))

    async def accept_answer(self, data):

        peer = data['m']['f'].split('/')[-1];
        logger.info('got an answer from {}'.format(peer))

        logger.debug('setting a remote description...')
        remote_desc = RTCSessionDescription(**data['p']['msg']);
        await self._pc.setRemoteDescription(remote_desc)

    def setup_iceevents(self):

        @self._pc.on('icegatheringstatechange')
        def on_icegatheringstatechange():
            logger.debug('iceGatheringState changed to {}'.format(self._pc.iceGatheringState))

        @self._pc.on('iceconnectionstatechange')
        def on_iceconnectionstatechange():
            logger.debug('iceConnectionState changed to {}'.format(self._pc.iceConnectionState))
            if self._pc.iceConnectionState == 'completed':
                self.state = self.PcState.CONNECTING
                logger.debug('current state = {}'.format(self._state))

    async def cleanup(self):

        # do some cleanups
        await self.close()

        if not self._state == self.PcState.TERMINATED:
            self.state = self.PcState.ICE_NOT_READY

        return True

    async def close(self):

        await self._pc.close()

if __name__ == '__main__':
    parser = argparse.ArgumentParser(description='xirsys python cli with aiortc')
    parser.add_argument('xirsys_url', help='an url prefix where getice.php, gethost.php, and gettoken.php from the official getting started guide are located. e.g. https://your.domain.com/xirsys')
    parser.add_argument('user_name', help='a user name for a signaling')
    parser.add_argument('--verbose', '-v', action='store_true', help='debug logging enabled if set')

    args = parser.parse_args()

    f = '%(asctime)s [%(thread)d] %(message)s'
    log_level = logging.INFO
    if args.verbose:
        log_level = logging.DEBUG
    logging.basicConfig(level=log_level, format=f)

    if not args.xirsys_url.startswith('http'):
        logging.error('xirsysurl should starts with http(s), exitting...')
        sys.exit(1)

    logger.info("getting xirsys ice hosts and tokens as {} with {}".format(args.user_name, args.xirsys_url))

    conn = PeerConnection(args.user_name, args.xirsys_url)

    asyncio.run(conn.run())

    logger.info('finished running xirsys cli')
