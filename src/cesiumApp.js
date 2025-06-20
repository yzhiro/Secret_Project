import * as Cesium from "cesium";

// --- グローバル変数: 表示されたレストランのピンを管理する配列 ---
let restaurantPinEntities = [];

/**
 * 既存のレストランのピンを全て地図上から削除する関数
 * @param {Cesium.Viewer} viewer 
 */
function clearRestaurantPins(viewer) {
  restaurantPinEntities.forEach(entity => {
    viewer.entities.remove(entity);
  });
  restaurantPinEntities = [];
}

/**
 * レストランの位置にピン（ビルボードとラベル）を立てる関数
 * @param {Cesium.Viewer} viewer 
 * @param {Object[]} shops - ホットペッパーAPIから取得した店舗情報の配列
 */
function showRestaurantPins(viewer, shops) {
  // PinBuilderを使ってアイコンを動的に生成
  const pinBuilder = new Cesium.PinBuilder();
  const pinIconUrl = pinBuilder.fromColor(Cesium.Color.fromCssColorString('#FF5733'), 48).toDataURL(); // オレンジ色のピン

  shops.forEach(shop => {
    const position = Cesium.Cartesian3.fromDegrees(shop.lng, shop.lat, 30); // 地上30mの高さにピンを表示

    const pinEntity = viewer.entities.add({
      position: position,
      // アイコン（ビルボード）の設定
      billboard: {
        image: pinIconUrl,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM, // ピンの先端が座標に合うように設定
      },
      // 店舗名のラベル設定
      label: {
        text: shop.name,
        font: '12pt sans-serif',
        style: Cesium.LabelStyle.FILL_AND_OUTLINE,
        outlineWidth: 2,
        verticalOrigin: Cesium.VerticalOrigin.BOTTOM,
        pixelOffset: new Cesium.Cartesian2(0, -55), // アイコンの上部に表示
      },
      // ピン自体をクリックした時にも情報が出るように設定
      description: `
        <h3><a href="${shop.urls.pc}" target="_blank" rel="noopener noreferrer">${shop.name}</a></h3>
        <p>${shop.catch}</p>
        <p>ジャンル: ${shop.genre.name}</p>
        <p>住所: ${shop.address}</p>
        <img src="${shop.photo.pc.m}" width="150">
      `,
    });
    // 管理用の配列に追加
    restaurantPinEntities.push(pinEntity);
  });
}

// --- ホットペッパーAPIからレストラン情報を取得する関数 (変更なし) ---
async function fetchHotpepperData(lat, lng) {
  const apiKey = import.meta.env.VITE_HOTPEPPER_API_KEY;
  if (!apiKey) return [];
  const params = new URLSearchParams({ key: apiKey, lat, lng, range: 2, count: 10, order: 4, format: "json" });
  const url = `/api/hotpepper?${params.toString()}`;
  try {
    const response = await fetch(url);
    if (!response.ok) throw new Error(`APIエラー: ${response.status}`);
    const data = await response.json();
    return data.results?.shop || [];
  } catch (error) {
    console.error("ホットペッパーAPIの取得に失敗:", error);
    return [];
  }
}

// --- InfoBoxに表示するHTMLを生成する関数 (変更なし) ---
function createDescriptionHtml(pickedFeature, shops) {
  let featureHtml = '';
  try {
    const keys = pickedFeature?.getPropertyIds?.() || [];
    const usageKeys = ["usage", "用途"];
    const getPropertySafely = (keys, candidates) => {
      const key = candidates.find(c => keys.includes(c));
      return key ? pickedFeature.getProperty(key) : "";
    };
    const usage = getPropertySafely(keys, usageKeys);
    featureHtml = `${usage ? `<p><b>用途:</b> ${usage}</p>` : ""}`;
  } catch (e) {
    console.error("地物情報の処理中にエラー:", e);
  }

  let shopsHtml = '<h3><br>周辺の飲食店情報</h3>';
  if (shops && shops.length > 0) {
    shopsHtml += `<ul style="list-style:none; padding:0; margin-top:1em;">`;
    shopsHtml += shops.map(shop => `
      <li style="margin-bottom: 1em; border-bottom: 1px solid #eee; padding-bottom: 1em;">
        <div style="display:flex; gap:1em;">
          <img src="${shop.photo.pc.s}" alt="${shop.name}" style="width:60px; height:60px; object-fit:cover; border-radius:4px;">
          <div style="flex:1;">
            <a href="${shop.urls.pc}" target="_blank" rel="noopener noreferrer" style="font-weight:bold;">${shop.name}</a>
            <p style="font-size:0.8em; margin:0.2em 0;">${shop.genre.name}</p>
          </div>
        </div>
      </li>
    `).join('');
    shopsHtml += `</ul>`;
  } else {
    shopsHtml += `<p>周辺に登録店舗は見つかりませんでした。</p>`;
  }

  return shopsHtml + featureHtml;
}


// --- メインのCesium初期化・実行関数 ---
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
    const tilesets = await Promise.all(tileUrls.map(url => Cesium.Cesium3DTileset.fromUrl(url)));
    tilesets.forEach(ts => viewer.scene.primitives.add(ts));
    if (tilesets.length > 0) await viewer.zoomTo(tilesets[0]);
  } catch (error) {
    console.error("タイルセットの読み込みに失敗:", error);
  }

  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);
  handler.setInputAction(async (click) => {
    // ★ クリック時に、まず古いピンをすべて消去
    clearRestaurantPins(viewer);

    const pickedFeature = viewer.scene.pick(click.position);
    const worldPosition = viewer.scene.pickPosition(click.position);

    if (!Cesium.defined(pickedFeature) || !Cesium.defined(worldPosition)) {
      viewer.selectedEntity = undefined;
      return;
    }

    const nameKey = ["名称", "name", "建物名称"].find(k => pickedFeature.getPropertyIds().includes(k));
    const entityName = pickedFeature.getProperty(nameKey || 'gml_id') || "周辺情報";
    viewer.selectedEntity = new Cesium.Entity({
      name: entityName,
      description: '周辺情報を検索しています...<br>お待ちください。',
    });

    const cartographic = Cesium.Cartographic.fromCartesian(worldPosition);
    const latitude = Cesium.Math.toDegrees(cartographic.latitude);
    const longitude = Cesium.Math.toDegrees(cartographic.longitude);
    const shops = await fetchHotpepperData(latitude, longitude);
    
    // ポップアップの中身を更新
    viewer.selectedEntity.description = createDescriptionHtml(pickedFeature, shops);

    // ★ 取得したレストラン情報のピンを地図上に表示
    showRestaurantPins(viewer, shops);

    viewer.scene.requestRender();
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);

  // ★ ポップアップが閉じたときにもピンを消すための処理
  viewer.selectedEntityChanged.addEventListener(() => {
    if (!Cesium.defined(viewer.selectedEntity)) {
      clearRestaurantPins(viewer);
    }
  });
}