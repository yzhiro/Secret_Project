import {
  auth, GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInWithPopup, signOut, onAuthStateChanged
} from './firebase.js';
import { startCesium } from './cesiumApp.js';

const $ = id => document.getElementById(id);
const ui = {
  mail:   $('mail'),
  pass:   $('pass'),
  signup: $('signup'),
  login:  $('login'),
  gLogin: $('glogin'),
  logout: $('logout'),
  status: $('status'),
  cesium: $('cesiumContainer')
};

/* ---------- ボタン動作 ---------- */
ui.signup.onclick = () =>
  createUserWithEmailAndPassword(auth, ui.mail.value, ui.pass.value)
    .catch(alert);

ui.login.onclick  = () =>
  signInWithEmailAndPassword(auth, ui.mail.value, ui.pass.value)
    .catch(alert);

ui.gLogin.onclick = () =>
  signInWithPopup(auth, new GoogleAuthProvider()).catch(alert);

ui.logout.onclick = () => signOut(auth);

/* ---------- 認証状態 ---------- */
onAuthStateChanged(auth, async user => {
  if (user) {
    ui.status.textContent = `ようこそ ${user.email || user.displayName}`;
    ui.logout.hidden = false;
    ui.signup.hidden = ui.login.hidden = ui.gLogin.hidden = true;
    await startCesium('cesiumContainer');
  } else {
    ui.status.textContent = 'login for secret project';
    ui.logout.hidden = true;
    ui.signup.hidden = ui.login.hidden = ui.gLogin.hidden = false;
    ui.cesium.innerHTML = ''; // ログアウトでビュー破棄
  }

  // ===== API接続デバッグ用テストコード =====
async function testHotpepperApi() {
  console.log("【デバッグ】API接続テストを開始します...");

  const apiKey = import.meta.env.VITE_HOTPEPPER_API_KEY;
  if (!apiKey) {
    console.error("【デバッグ】エラー: VITE_HOTPEPPER_API_KEYが読み込めていません。.envファイルの名前や場所、キーの記述が正しいか確認してください。");
    alert("APIキーが読み込めていません。開発者ツール（F12）のコンソールを確認してください。");
    return;
  }
  console.log("【デバッグ】OK: APIキーは.envファイルから読み込めています。");

  // 東京駅の緯度経度でテスト実行
  const testLat = 35.681236;
  const testLng = 139.767125;

  const params = new URLSearchParams({
    key: apiKey,
    lat: testLat,
    lng: testLng,
    range: 3,
    format: "json",
  });

  // vite.config.jsのプロキシ設定を経由するURL
  const url = `/api/hotpepper?${params.toString()}`;
  console.log(`【デバッグ】リクエストURL: ${window.location.origin}${url}`);

  try {
    const response = await fetch(url);
    console.log("【デバッグ】APIからのレスポンス:", response);

    if (!response.ok) {
      throw new Error(`APIサーバーからエラー応答がありました。ステータス: ${response.status}`);
    }

    const data = await response.json();
    console.log("【デバッグ】テスト成功！取得したデータ:", data);
    alert("API接続テスト成功！ 開発者ツール（F12）のコンソールに取得データが表示されています。");

  } catch (error) {
    console.error("【デバッグ】エラー: API接続中に問題が発生しました。", error);
    alert("API接続テストでエラーが発生しました。開発者ツール（F12）のコンソールで詳細を確認してください。");
  }
}

// ページが読み込まれてから3秒後にテストを自動実行します
setTimeout(testHotpepperApi, 3000);
// =====================================
});
