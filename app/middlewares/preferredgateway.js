/*
* GEO */
const geodesy = require('geodesy');
const maxmind = require('maxmind');
const geolite2 = require('geolite2');
const dns = require('dns');

const LatLonEllipsoidal = geodesy.LatLonEllipsoidal;
const MaxmindDb = maxmind.openSync(geolite2.paths.city);//maxmind.openSync(config.get('maxmind.db'));

//
function getIPs(hostnames){
    return new Promise(resolve => {
        let ips = [];
        let callback = (error, ip, hostname)=>{
            //ips = ips.concat(addresses);
            if(error)return;
            ips.push({ip:ip[0], hostname});
            if(ips.length === hostnames.length)resolve(getLocations(ips));
        };

        for(let hostname of hostnames){
            dns.resolve4(hostname, (error, addresses)=>{
                callback(error, addresses, hostname)
            })//Promisify
        }
    })
}
function getLocations(ipList){
    let locations = [];
    for(let ipo of ipList){
        let location = MaxmindDb.get(ipo.ip);
        location = Object.assign({},location,ipo);
        locations.push(location);
    }
    return locations;
}
function getPreferredLocation(location, coordinates) {

    let preferredLoc;
    let shortestD = 196900000;

    for(let coordinate of coordinates){
        console.log(coordinate.hostname);
        let d = getDistance(location.location, coordinate.location);
        console.log(d.toFixed(3))

        if (d < shortestD) {
            preferredLoc = coordinate;
            shortestD = d
        }


    }

    return preferredLoc;
}

function getDistance(coordinate1, coordinate2) {
    let p1 = new LatLonEllipsoidal(coordinate1.latitude, coordinate1.longitude);
    let p2 = new LatLonEllipsoidal(coordinate2.latitude, coordinate2.longitude);

    let distance = p1.distanceTo(p2);
    if (!distance) {
        distance = p2.distanceTo(p1);
        if (!distance) {
            // this is a bug in the Geodesy library, we should look into
            //console.warn('Failed to calculate distance between points. P1: %j P2: %j', p1, p2);
            // assume distance is 0 (?), there really is no good fallback here
            distance = 0;
        }
    }

    return distance;
}
module.exports = function (gateways) {
    return (req, res, next)=>{
        let  pl;
        let clientLocation = MaxmindDb.get(req.ip);

        if(!clientLocation){
            console.log('clien loc');
            //clientLocation = MaxmindDb.get('138.197.139.250');//br'181.215.183.204',tk'52.194.163.111'
            return next();
        }

        getIPs(gateways).then(locations =>{
            pl = getPreferredLocation(clientLocation, locations);
            req.XIRSYS_GATEWAY = pl.hostname;
            next();
        });
    };
};
/*!GEO*/
