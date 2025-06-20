/**
 * Mapbox Directions API を使って二点間の歩行ルートを取得する
 * @param {{lon: number, lat: number}} startCoords - 開始地点の座標
 * @param {{lon: number, lat: number}} endCoords - 終了地点の座標
 * @returns {Promise<number[][]|null>} - 経路を構成する座標の配列 [[lon, lat], [lon, lat], ...]
 */
export async function getRoute(startCoords, endCoords) {
  const apiKey = import.meta.env.VITE_MAPBOX_TOKEN;
  if (!apiKey) {
    console.error("Mapboxのアクセストークンが設定されていません。");
    return null;
  }

  const profile = "walking"; // 'walking', 'cycling', 'driving' などが選択可能
  const coordinates = `${startCoords.lon},${startCoords.lat};${endCoords.lon},${endCoords.lat}`;
  const url = `https://api.mapbox.com/directions/v5/mapbox/${profile}/${coordinates}?geometries=geojson&access_token=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Mapbox Directions API Error: ${response.statusText}`);
    }
    const data = await response.json();
    if (data.routes && data.routes.length > 0) {
      // 経路の座標配列を返す
      return data.routes[0].geometry.coordinates;
    }
    return null;
  } catch (error) {
    console.error("経路情報の取得に失敗しました:", error);
    return null;
  }
}
