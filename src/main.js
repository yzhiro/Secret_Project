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
});