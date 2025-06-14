// ───────────────────────────────────────────
//  src/cesiumApp.js
//  （このファイルを上書き保存してください）
// ───────────────────────────────────────────
import * as Cesium from "cesium";

export async function startCesium(containerId) {
  /* Ion トークン */
  Cesium.Ion.defaultAccessToken = import.meta.env.VITE_CESIUM_TOKEN;

  /* Viewer */
  const viewer = new Cesium.Viewer(containerId, {
    terrain: Cesium.Terrain.fromWorldTerrain(),
    timeline: false,
    animation: false,
  });

  /* 港区タイルセット（必要に応じて追加） */
  const tileUrls = [
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod1/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod2/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod3/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod2_no_texture/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_bldg_3dtiles_13103_minato-ku_lod3_no_texture/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_brid_3dtiles_lod1/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_brid_3dtiles_lod2/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_brid_3dtiles_lod3/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_fld_pref_furukawa_shibuyagawa-furukawa-etc_3dtiles_l1_no_texture/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_fld_pref_furukawa_shibuyagawa-furukawa-etc_3dtiles_l2_no_texture/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_fld_pref_jonan-chiku_3dtiles_l2_no_texture/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_fld_pref_koto-naibu_3dtiles_l2_no_texture/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_fld_pref_sumidagaw-shingashigawa-ryuiki_3dtiles_l2_no_texture/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_frn_3dtiles_lod1/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_frn_3dtiles_lod3/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_htd_13_1_3dtiles_no_texture/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_tran_3dtiles_lod3/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_veg_PlantCover_3dtiles_lod1/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_veg_PlantCover_3dtiles_lod3/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_veg_SolitaryVegetationObject_3dtiles_lod1/tileset.json",
    "./13103_minato-ku_pref_2023_3dtiles_mvt_2_op/13103_minato-ku_pref_2023_citygml_2_op_veg_SolitaryVegetationObject_3dtiles_lod3/tileset.json",
  ];

  /* 読み込み＆追加 */
  const tilesets = [];
  await Promise.all(
    tileUrls.map(async (url) => {
      const ts = await Cesium.Cesium3DTileset.fromUrl(url);
      viewer.scene.primitives.add(ts);
      tilesets.push(ts);
      return ts.readyPromise;
    })
  );

  /* 1) 最初の Tileset へズーム（配列ではなく単体） */
  if (tilesets.length) {
    await viewer.zoomTo(tilesets[0]); // ← ここがポイント
  }

  /* ---------- クリックで属性ポップアップ ---------- */
  const handler = new Cesium.ScreenSpaceEventHandler(viewer.scene.canvas);

  handler.setInputAction((click) => {
    const picked = viewer.scene.pick(click.position);
    if (!Cesium.defined(picked) || !picked.getProperty) return;

    /* 1) そのフィーチャが実際に持っているキー一覧 */
    const keys = picked.getPropertyIds?.() || [];

    /* 2) 表示したい候補キーを優先順で用意 */
    const nameKeys = ["名称", "name", "建物名称", "橋梁名称", "gml_id"];
    const usageKeys = [
      "usage",
      "用途",
      "building_purpose",
      "建物用途",
      "用途地域名称",
    ];

    /* 3) ヘルパ：候補の中で最初にヒットしたキーを返す */
    const firstHit = (candidates) => candidates.find((k) => keys.includes(k));

    /* 4) name / usage を取得（無ければ空文字） */
    const hitNameKey = firstHit(nameKeys);
    const hitUsageKey = firstHit(usageKeys);

    const name = hitNameKey ? picked.getProperty(hitNameKey) : "";
    const usage = hitUsageKey ? picked.getProperty(hitUsageKey) : "";

    /* 5) すべてのプロパティをテーブル化（デバッグ兼用） */
    const tableRows = keys
      .map((k) => `<tr><th>${k}</th><td>${picked.getProperty(k)}</td></tr>`)
      .join("");

    /* 6) ポップアップ生成 */
    viewer.selectedEntity = new Cesium.Entity({
      name: name || "属性情報",
      description: `
      ${usage ? `<p><b>用途:</b> ${usage}</p>` : ""}
      <details><summary>すべての属性を見る</summary>
        <table class="cesium-infoBox-defaultTable">${tableRows}</table>
      </details>`,
    });
  }, Cesium.ScreenSpaceEventType.LEFT_CLICK);
}
