# A sample python app with aiortc

This python app is a sample app that works in the same way as the one in the getting started guide, [Learning WebRTC: The Ultimate Getting Started Guide](https://www.xirsys.com/developers/Learning_WebRTC_Starter_Guide.pdf), with the python library called [aiortc](https://github.com/aiortc/aiortc).

## Installation

The following requirements have to be met to install this app, which is the same requirements as aiortc.

* asyncio(>= python 3.5)
* ffmpeg 3.2(see [pyav doc](https://docs.mikeboers.com/pyav/develop/installation.html) for details)

```
$ sudo apt-get install libavdevice-dev libavfilter-dev libopus-dev libvpx-dev pkg-config
$ pip install aiortc websockets requests
```

## Usage

After changing your current directory, run the following command to see how to launch this app.

```
$ python cli.py -h
usage: cli.py [-h] [--verbose] xirsys_url user_name

xirsys python cli with aiortc

positional arguments:
  xirsys_url     an url prefix where getice.php, gethost.php, and gettoken.php
                 from the official getting started guide are located. e.g.
                 https://your.domain.com/xirsys
  user_name      a user name for a signaling

optional arguments:
  -h, --help     show this help message and exit
  --verbose, -v  debug logging enabled if set
```

Suppose you have setup your xirsys server at https://your.domain.com/xirsys, which means getice.php is accessible via https://your.domain.com/xirsys/getice.php, and are going to use xirsysapp as your user name, run the following command.

```
$ python cli.py "https://your.domain.com/xirsys" "xirsysapp"
```
