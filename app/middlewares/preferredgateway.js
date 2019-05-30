const geodesy  = require('geodesy');
const maxmind  = require('maxmind');
const geolite2 = require('geolite2');
const dns      = require('dns').promises;

const LatLonEllipsoidal = geodesy.LatLonEllipsoidal;
const MaxmindDb         = maxmind.openSync(geolite2.paths.city);//maxmind.openSync(config.get('maxmind.db'));
//
function hostnamesLocations(hostnames) {
  let filter = [];
  return [...hostnames].reduce((p, _, i) =>
                                 p.then(_ => new Promise(resolve => {
                                   let hostname = hostnames[i];
                                   if (!!hostname) {
                                     dns.resolve4(hostname)
                                       .then((result) => {
                                         filter.push({ip: result[0], hostname});
                                         resolve(getLocations(filter));
                                       })
                                       .catch((error) => {
                                         resolve(getLocations(filter));
                                       })
                                   }
                                 }))
    , Promise.resolve());
}

function getLocations(ipList) {
  let locations = [];
  for (let ipo of ipList) {
    let location = MaxmindDb.get(ipo.ip);
    location     = Object.assign({}, location, ipo);
    locations.push(location);
  }
  return locations;
}

function getPreferredLocation(location, coordinates) {
  let preferredLocation;
  let shortestD = 196900000;//miles around the world

  for (let coordinate of coordinates) {
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

module.exports = function (gateways) {
  return (req, res, next) => {
    if(!gateways.length)return next();//no gateways, move on
    let pl;
    let clientLocation = MaxmindDb.get(req.ip);

    if (!clientLocation) {
      return next();
    }

    hostnamesLocations(gateways)
      .then(locations => {
        try {
          pl                 = getPreferredLocation(clientLocation, locations);
          req.XIRSYS_GATEWAY = pl.hostname;
          next();
        } catch (e) {
          next();
        }
      })
      .catch(()=>{
        next();
      });
  };
};
