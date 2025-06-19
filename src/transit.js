// src/transit.js （新規作成）

/**
 * 公共交通オープンデータセンターAPIから都営バスの現在位置情報を取得する
 * @returns {Promise<Object[]>} - バスの位置情報オブジェクトの配列
 */
export async function getBusLocations() {
  const apiKey = import.meta.env.VITE_ODPT_API_KEY;
  if (!apiKey) {
    console.error("公共交通オープンデータセンターのAPIキーが設定されていません。");
    return [];
  }

  // 都営バスの車両情報を取得するAPIエンドポイント
  const url = `https://api.odpt.org/api/v4/odpt:Bus.json?odpt:operator=odpt.Operator:Toei&acl:consumerKey=${apiKey}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Bus API Error: ${response.statusText}`);
    }
    const data = await response.json();

    // 必要な情報だけを抽出・整形して返す
    return data.map(bus => ({
      id: bus['@id'], // 各バスのユニークID
      busNumber: bus['odpt:busNumber'],
      route: bus['odpt:busroute'],
      lat: bus['geo:lat'],
      lon: bus['geo:long'],
      azimuth: bus['odpt:azimuth'] || 0, // バスの向き（方位角）
    }));

  } catch (error) {
    console.error("バス情報の取得に失敗しました:", error);
    return [];
  }
}