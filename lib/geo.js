// Shared geo helpers (server + tests). Zero deps.
// Haversine distance in km between two WGS84 points.
function toRad(d) { return (d * Math.PI) / 180; }
function havKm(lat1, lon1, lat2, lon2) {
  var R = 6371;
  var dLat = toRad(lat2 - lat1), dLon = toRad(lon2 - lon1);
  var a = Math.sin(dLat / 2) * Math.sin(dLat / 2) +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
    Math.sin(dLon / 2) * Math.sin(dLon / 2);
  return 2 * R * Math.asin(Math.sqrt(a));
}
function isLatLon(lat, lon) {
  lat = +lat; lon = +lon;
  return Number.isFinite(lat) && Number.isFinite(lon) &&
    lat >= -90 && lat <= 90 && lon >= -180 && lon <= 180;
}
if (typeof module !== "undefined") module.exports = { havKm, isLatLon };
