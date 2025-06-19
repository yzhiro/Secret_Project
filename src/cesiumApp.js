// src/cesiumApp.js （修正後）

import * as Cesium from "cesium";

/**
 * 周辺の飲食店情報をHot Pepper APIから非同期で取得する
 * @param {number} lat - 緯度
 * @param {number} lng - 経度
 * @returns {Promise<Object[]>} - 店舗情報の配列
 */
async function fetchHotpepperData(lat, lng) {
  const apiKey = import.meta.env.VITE_HOTPEPPER_API_KEY;
  if (!apiKey) {
    console.warn("VITE_HOTPEPPER_API_KEY が .env ファイルに設定されていません。");
    return [];
  }

  // Viteプロキシ経由でAPIにリクエストするためのURLを作成
  const params = new URLSearchParams({
    key: apiKey,
    lat: lat,
    lng: lng,
    range: 3, // 検索範囲 (1: 300m, 2: 500m, 3: 1000m)
    order: 4, // 口コミ評価順
    format: "json",
  });

  // vite.config.js のプロキシ設定に合わせたパス
  const url = `/api/hotpepper?${params.toString()}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`APIエラー: ${response.status} ${response.statusText}`);
    }
    const data = await response.json();
    return data.results?.shop || [];
  } catch (error) {
    console.error("ホットペッパーAPIの取得に失敗しました:", error);
    alert(`周辺店舗の取得に失敗しました。\n${error.message}`);
    return [];
  }
}

/**
 * CesiumのInfoBoxに表示するHTMLコンテンツを生成する
 * @param {Cesium.Cesium3DTileFeature} pickedFeature - クリックされたフィーチャ
 * @param {Object[]} shops - 店舗情報の配列
 * @returns {string} - 表示用のHTML文字列
 */
function createDescriptionHtml(pickedFeature, shops) {
  // --- 1. 地物自体の属性情報を取得・整形 ---
  const keys = pickedFeature.getPropertyIds();
  const nameKeys = ["名称", "name", "建物名称", "橋梁名称"];
  const usageKeys = ["usage", "用途", "building_purpose", "建物用途"];

  const findKey = (candidates) => candidates.find(k => keys.includes(k));
  const name = pickedFeature.getProperty(findKey(nameKeys) || 'gml_id');
  const usage = pickedFeature.getProperty(findKey(usageKeys)) || "";

  const allAttributesTable = keys
    .map(key => `<tr><th style="white-space:nowrap; padding-right:1em;">${key}</th><td>${pickedFeature.getProperty(key)}</td></tr>`)
    .join("");

  // --- 2. 周辺店舗情報のHTMLを生成 ---
  let shopsHtml = '<h3><br>周辺の飲食店情報（ホットペッパー）</h3>';
  if (shops.length > 0) {
    shopsHtml += `<ul style="list-style:none; padding:0; margin-top:1em;">`;
    shopsHtml += shops.map(shop => `
      <li style="margin-bottom: 1em; border-bottom: 1px solid #eee; padding-bottom: 1em;">
        <div style="display:flex; gap:1em;">
          <img src="${shop.photo.pc.s}" alt="${shop.name}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;">
          <div style="flex:1;">
            <a href="${shop.urls.pc}" target="_blank" rel="noopener noreferrer" style="font-weight:bold; color:#1e90ff;">${shop.name}</a>
            <p style="font-size:0.8em; margin:0.2em 0;">${shop.genre.name} / ${shop.catch}</p>
          </div>
        </div>
      </li>
    `).join('');
    shopsHtml += `</ul>`;
  } else {
    shopsHtml += '<p>周辺に登録されている店舗は見つかりませんでした。</p>';
  }

  // --- 3. 全ての情報を結合して返す ---
  return `
    ${usage ? `<p><b>用途:</b> ${usage}</p>` : ""}
    ${shopsHtml}
    <details>
      <summary style="cursor:pointer; margin-top:1em;">地物の全属性情報</summary>
      <table class="cesium-infoBox-defaultTable" style="margin-top:0.5em;">${allAttributesTable}</table>
    </details>
  `;
}

export async function startCesium(containerId) {
  Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

  const viewer = new Cesium.Viewer(containerId, {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    timeline: false,
    animation: false,
    infoBox: true,
  });

  const tileUrls = [ "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod1/tileset.json", "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod2/tileset.json", ];
  const tilesets = await Promise.all(
    tileUrls.map(url => Cesium.Cesium3DTileset.fromUrl(url))
  );
  tilesets.forEach(ts => viewer.scene.primitives.add(ts));
  if (tilesets.length > 0) {
    await viewer.zoomTo(tilesets[0]);
  }

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(async (click) => {
    const pickedFeature = viewer.scene.pick(click.position);
    const worldPosition = viewer.scene.pickPosition(click.position);

    if (!Cesium.defined(pickedFeature) || !Cesium.defined(worldPosition)) {
      viewer.selectedEntity = undefined; // 何も選択されていない場合はポップアップを閉じる
      return;
    }

    // 最初に地物の基本情報でポップアップを仮表示
    const nameKey = ["名称", "name", "建物名称", "橋梁名称"].find(k => pickedFeature.getPropertyIds().includes(k));
    const entityName = pickedFeature.getProperty(nameKey || 'gml_id');
    viewer.selectedEntity = new Cesium.Entity({
      name: entityName,
      description: '周辺情報を検索しています...<br>しばらくお待ちください。',
    });

    // カートesian3座標を緯度経度に変換
    const cartographic = Cesium.Cartographic.fromCartesian(worldPosition);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);

    // APIから周辺店舗データを非同期で取得
    const shops = await fetchHotpepperData(latitude, longitude);

    // 取得した情報でポップアップの内容を更新
    viewer.selectedEntity.description = createDescriptionHtml(pickedFeature, shops);

  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}