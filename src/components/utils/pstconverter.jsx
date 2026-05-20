const VALID_DAYS = 30;

function getNowPST() {
  return new Date(
    new Date().toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
    })
  );
}

function convertUTCtoPST(dateStr) {
  if (!dateStr) return null;

  const utcDate = new Date(dateStr);
  if (isNaN(utcDate.getTime())) return null;

  return new Date(
    utcDate.toLocaleString("en-US", {
      timeZone: "America/Los_Angeles",
    })
  );
}

export function getExpiryDate(dateStr) {
  const pstDate = convertUTCtoPST(dateStr);
  if (!pstDate) return null;

  pstDate.setDate(pstDate.getDate() + VALID_DAYS);

  return pstDate.toISOString().split("T")[0];
}

export function isExpired(dateStr) {
  const pstDate = convertUTCtoPST(dateStr);
  if (!pstDate) return false;

  pstDate.setDate(pstDate.getDate() + VALID_DAYS);

  return pstDate.getTime() < getNowPST().getTime();
}

export function isExpiringSoon(dateStr) {
  const pstDate = convertUTCtoPST(dateStr);
  if (!pstDate) return false;

  pstDate.setDate(pstDate.getDate() + VALID_DAYS);

  const diff =
    (pstDate.getTime() - getNowPST().getTime()) / 86400000;

  return diff <= 7 && diff >= 0;
}