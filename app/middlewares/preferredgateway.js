const config  = require('config');
const geodesy = require('geodesy');
const maxmind = require('maxmind');
const dns     = require('dns');

const LatLonEllipsoidal = geodesy.LatLonEllipsoidal;
let MaxmindDb;
if(config.get('maxmind.db') === 'hosted'){
  const geolite2 = require('geolite2');
  MaxmindDb     = maxmind.openSync(geolite2.paths.city);
}else{
  MaxmindDb = maxmind.openSync(config.get('maxmind.db'));
}
//
function hostnamesLocations(hostnames) {
  let promises = [];
  for (let h of hostnames) {
    if (h) {
      promises.push(new Promise((resolve, reject) => {
        dns.resolve4(h, (err, result) => {
          if (err) {
            console.error('Error resolving DNS', err);
            resolve(null);
            return;
          }
          resolve(getLocations({ip: result[0], hostname: h}));
        });
      }));
    }
  }

  return Promise.all(promises);
}

function getLocations(ipo) {
  let location = MaxmindDb.get(ipo.ip);
  return Object.assign({}, location, ipo);
}

function getPreferredLocation(location, coordinates) {
  let preferredLocation;
  let shortestD = Number.MAX_SAFE_INTEGER;

  for (let coordinate of coordinates) {
    if (!coordinate) {
      continue;
    }
    //console.log(coordinate.hostname);
    let d = getDistance(location.location, coordinate.location);
    if (d < shortestD) {
      preferredLocation = coordinate;
      shortestD         = d
    }
  }

  return preferredLocation;
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

module.exports = function (xirsys) {
  let gateways = xirsys.gateways;
  return (req, res, next) => {
    if (!gateways.length) {
      console.log('gateways not found');
      req.PREFERRED_XIRSYS_GATEWAY = xirsys.gateway;
      return next();
    }//no gateways, move on
    let pl;
    let clientLocation = MaxmindDb.get(req.ip);

    if (!clientLocation) {
      console.log('client location not found ', req.ip);
      req.PREFERRED_XIRSYS_GATEWAY = xirsys.gateway;
      return next();
    }

    hostnamesLocations(gateways)
      .then(locations => {
        try {
          pl                           = getPreferredLocation(clientLocation, locations);
          req.PREFERRED_XIRSYS_GATEWAY = pl.hostname;
          console.log('PREFERRED_XIRSYS_GATEWAY ', req.PREFERRED_XIRSYS_GATEWAY);
          next();
        } catch (e) {
          req.PREFERRED_XIRSYS_GATEWAY = xirsys.gateway;
          next();
        }
      })
      .catch(() => {
        req.PREFERRED_XIRSYS_GATEWAY = xirsys.gateway;
        next();
      });
  };
};
