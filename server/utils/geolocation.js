const EARTH_RADIUS_METERS = 6371e3;

const toRad = (deg) => deg * (Math.PI / 180);

const haversineDistanceMeters = (lat1, lon1, lat2, lon2) => {
  const p1 = toRad(lat1);
  const p2 = toRad(lat2);
  const dp = toRad(lat2 - lat1);
  const dl = toRad(lon2 - lon1);

  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2;
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  return EARTH_RADIUS_METERS * c;
};

const isWithinRadius = (source, target, radiusMeters) => {
  const distance = haversineDistanceMeters(
    Number(source.latitude),
    Number(source.longitude),
    Number(target.latitude),
    Number(target.longitude)
  );

  return {
    distanceMeters: distance,
    isInside: distance <= Number(radiusMeters || 0)
  };
};

module.exports = { haversineDistanceMeters, isWithinRadius };
