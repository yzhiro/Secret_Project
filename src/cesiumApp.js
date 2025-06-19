// src/cesiumApp.js （最終・完成版）

import * as Cesium from "cesium";

async function fetchHotpepperData(lat, lng) {
  const apiKey = import.meta.env.VITE_HOTPEPPER_API_KEY;
  if (!apiKey) {
    console.warn("VITE_HOTPEPPER_API_KEY が .env ファイルに設定されていません。");
    return [];
  }

  const params = new URLSearchParams({
    key: apiKey,
    lat: lat,
    lng: lng,
    range: 2,
    count: 10,
    order: 4,
    format: "json",
  });

  const url = `/api/hotpepper?${params.toString()}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000);

  try {
    const response = await fetch(url, { signal: controller.signal });
    clearTimeout(timeoutId);
    if (!response.ok) throw new Error(`APIエラー: ${response.status}`);
    const data = await response.json();
    return data.results?.shop || [];
  } catch (error) {
    clearTimeout(timeoutId);
    if (error.name === 'AbortError') {
      alert("店舗情報の取得がタイムアウトしました。");
    } else {
      alert(`店舗情報の取得に失敗しました。\n${error.message}`);
    }
    return [];
  }
}

/**
 * CesiumのInfoBoxに表示するHTMLコンテンツを生成する（エラー対策強化版）
 * @param {Cesium.Cesium3DTileFeature} pickedFeature - クリックされたフィーチャ
 * @param {Object[]} shops - 店舗情報の配列
 * @returns {string} - 表示用のHTML文字列
 */
function createDescriptionHtml(pickedFeature, shops) {
  let featureHtml = '';
  try {
    // --- 地物自体の属性情報を安全に取得 ---
    // ?. (オプショナルチェーン) を使い、プロパティが存在しない場合でもエラーにならないようにする
    const keys = pickedFeature?.getPropertyIds?.() || [];
    const nameKeys = ["名称", "name", "建物名称", "橋梁名称"];
    const usageKeys = ["usage", "用途", "building_purpose", "建物用途"];
    
    const getPropertySafely = (keys, candidates) => {
      const key = candidates.find(c => keys.includes(c));
      return key ? pickedFeature.getProperty(key) : "";
    };

    const name = getPropertySafely(keys, nameKeys) || pickedFeature?.getProperty?.('gml_id') || "地物情報";
    const usage = getPropertySafely(keys, usageKeys);

    const allAttributesTable = keys
      .map(key => `<tr><th style="white-space:nowrap; padding-right:1em;">${key}</th><td>${pickedFeature.getProperty(key)}</td></tr>`)
      .join("");

    featureHtml = `
      ${usage ? `<p><b>用途:</b> ${usage}</p>` : ""}
      <details>
        <summary style="cursor:pointer; margin-top:1em;">地物の全属性情報</summary>
        <table class="cesium-infoBox-defaultTable" style="margin-top:0.5em;">${allAttributesTable}</table>
      </details>
    `;
  } catch (e) {
    console.error("地物情報の処理中にエラーが発生しました:", e);
    featureHtml = "<p>地物情報の表示に失敗しました。</p>";
  }


  // --- 周辺店舗情報のHTMLを生成 ---
  let shopsHtml = '<h3><br>周辺の飲食店情報（ホットペッパー）</h3>';
  if (shops && shops.length > 0) {
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
    shopsHtml += `
      <div style="background-color: #fffbe6; border: 1px solid #ffe58f; padding: 12px; border-radius: 4px; margin-top: 1em;">
        <p style="font-weight: bold; color: #d46b08;">検索結果: 0件</p>
        <p style="color: #595959; margin-top: 4px;">この地点の周辺 (500m以内) にホットペッパー掲載店舗は見つかりませんでした。</p>
      </div>
    `;
  }

  return shopsHtml + featureHtml;
}

export async function startCesium(containerId) {
  Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;
  const viewer = new Cesium.Viewer(containerId, {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    timeline: false,
    animation: false,
    infoBox: true,
  });

  const tileUrls = [
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod1/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod2/tileset.json",
  ];
  try {
    const tilesets = await Promise.all(
      tileUrls.map(url => Cesium.Cesium3DTileset.fromUrl(url))
    );
    tilesets.forEach(ts => viewer.scene.primitives.add(ts));
    if (tilesets.length > 0) {
      await viewer.zoomTo(tilesets[0]);
    }
  } catch (error) {
    console.error("タイルセットの読み込みに失敗しました。", error);
    alert("3Dデータの読み込みに失敗しました。ファイルパスを確認してください。");
  }


  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(async (click) => {
    const pickedFeature = viewer.scene.pick(click.position);
    const worldPosition = viewer.scene.pickPosition(click.position);
    if (!Cesium.defined(pickedFeature) || !Cesium.defined(worldPosition)) {
      viewer.selectedEntity = undefined;
      return;
    }

    const nameKey = ["名称", "name", "建物名称", "橋梁名称"].find(k => pickedFeature.getPropertyIds().includes(k));
    const entityName = pickedFeature.getProperty(nameKey || 'gml_id') || "周辺情報";
    viewer.selectedEntity = new Cesium.Entity({
      name: entityName,
      description: '周辺情報を検索しています...<br>お待ちください。',
    });

    const cartographic = Cesium.Cartographic.fromCartesian(worldPosition);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);

    const shops = await fetchHotpepperData(latitude, longitude);

    // 更新後の安全な関数を呼び出す
    viewer.selectedEntity.description = createDescriptionHtml(pickedFeature, shops);
    // InfoBoxがすぐに更新されない場合があるため、再描画を促す
    viewer.scene.requestRender();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}