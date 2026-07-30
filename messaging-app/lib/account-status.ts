export function isUserCurrentlyBanned(user: any, now = new Date()) {
  if (!user) return false;
  if (user.bannedPermanently === true) return true;
  return Boolean(user.bannedUntil && new Date(user.bannedUntil) > now);
}

export function getBanLabel(user: any, now = new Date()) {
  if (!isUserCurrentlyBanned(user, now)) return "None";
  if (user.bannedPermanently) return "Permanent";
  return `Until ${new Date(user.bannedUntil).toLocaleString()}`;
}
