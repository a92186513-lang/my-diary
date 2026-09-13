// =========================
// Supabase 설정
// =========================

const SUPABASE_URL =
  "https://dpupbhznbbdbobbuuopp.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_couA8z5b6tBRmrF1xoZJAA_ISxiVATJ";


const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY,
    {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
        detectSessionInUrl: true,
        flowType: "implicit"
      }
    }
  );


// =========================
// HTML 요소
// =========================

const cryptoLogoutBtn =
  document.getElementById(
    "cryptoLogoutBtn"
  );

const loginScreen =
  document.getElementById("loginScreen");

const cryptoScreen =
  document.getElementById("cryptoScreen");

const diaryApp =
  document.getElementById("diaryApp");

const googleLoginBtn =
  document.getElementById("googleLoginBtn");

const logoutBtn =
  document.getElementById("logoutBtn");

const userEmail =
  document.getElementById("userEmail");


// =========================
// 화면
// =========================

function showLogin() {

  loginScreen.style.display = "flex";
  cryptoScreen.style.display = "none";
  diaryApp.style.display = "none";

}


function showCryptoScreen() {

  loginScreen.style.display = "none";
  cryptoScreen.style.display = "flex";
  diaryApp.style.display = "none";

}


async function showDiary(session) {

  loginScreen.style.display = "none";
  cryptoScreen.style.display = "none";
  diaryApp.style.display = "block";


  if (session?.user?.email) {

    userEmail.textContent =
      session.user.email;

  }


  if (
    typeof refreshHome === "function"
  ) {

    await refreshHome();

  }

}


// =========================
// 로그인 성공 후 처리
// =========================

async function handleLoggedInUser(session) {

  if (!session?.user) {

    showLogin();
    return;

  }


  console.log(
    "Google 로그인 성공:",
    session.user.email
  );


  showCryptoScreen();


  if (
    typeof prepareCryptoScreen ===
    "function"
  ) {

    await prepareCryptoScreen(
      session
    );

  } else {

    console.error(
      "crypto.js가 정상적으로 로드되지 않았습니다."
    );

  }

}


// =========================
// URL에 돌아온 OAuth 토큰 처리
// =========================

async function handleOAuthCallback() {

  if (
    !window.location.hash ||
    !window.location.hash.includes(
      "access_token="
    )
  ) {

    return null;

  }


  const params =
    new URLSearchParams(
      window.location.hash.substring(1)
    );


  const accessToken =
    params.get("access_token");

  const refreshToken =
    params.get("refresh_token");


  if (
    !accessToken ||
    !refreshToken
  ) {

    return null;

  }


  const {
    data,
    error
  } =
    await supabaseClient.auth.setSession({

      access_token:
        accessToken,

      refresh_token:
        refreshToken

    });


  if (error) {

    console.error(
      "세션 저장 실패:",
      error
    );

    return null;

  }


  // 매우 중요
  // 주소창에서 토큰 즉시 제거
  window.history.replaceState(
    {},
    document.title,
    window.location.pathname
  );


  return data.session;

}


// =========================
// Google 로그인
// =========================

googleLoginBtn.addEventListener(
  "click",
  async () => {

    googleLoginBtn.disabled =
      true;

    googleLoginBtn.textContent =
      "Google 로그인 중...";


    const redirectUrl =
      window.location.origin +
      window.location.pathname;


    const {
      error
    } =
      await supabaseClient.auth
        .signInWithOAuth({

          provider:
            "google",

          options: {

            redirectTo:
              redirectUrl

          }

        });


    if (error) {

      console.error(error);

      alert(
        "Google 로그인에 실패했습니다."
      );


      googleLoginBtn.disabled =
        false;

      googleLoginBtn.textContent =
        "G Google로 계속하기";

    }

  }
);


// =========================
// 로그아웃
// =========================

logoutBtn.addEventListener(
  "click",
  async () => {

    if (
      typeof clearDiaryCryptoKey ===
      "function"
    ) {

      clearDiaryCryptoKey();

    }


    await supabaseClient.auth
      .signOut();


    userEmail.textContent = "";

    showLogin();

  }
);

cryptoLogoutBtn.addEventListener(
  "click",
  async () => {

    if (
      typeof clearDiaryCryptoKey ===
      "function"
    ) {

      clearDiaryCryptoKey();

    }


    const {
      error
    } =
      await supabaseClient.auth
        .signOut();


    if (error) {

      console.error(
        "로그아웃 오류:",
        error
      );

      alert(
        "로그아웃 중 문제가 발생했습니다."
      );

      return;

    }


    userEmail.textContent =
      "";


    showLogin();

  }
);


// =========================
// 앱 시작
// =========================

async function initializeAuth() {

  try {

    // 1. Google에서 방금 돌아온 경우
    let session =
      await handleOAuthCallback();


    // 2. 이미 로그인했던 사용자
    if (!session) {

      const {
        data,
        error
      } =
        await supabaseClient.auth
          .getSession();


      if (error) {

        throw error;

      }


      session =
        data.session;

    }


    if (session) {

      await handleLoggedInUser(
        session
      );

    } else {

      showLogin();

    }


  } catch (error) {

    console.error(
      "로그인 처리 오류:",
      error
    );

    showLogin();

  }

}


// =========================
// 로그아웃 감지
// =========================

supabaseClient.auth.onAuthStateChange(
  (event) => {

    if (
      event === "SIGNED_OUT"
    ) {

      showLogin();

    }

  }
);


window.addEventListener(
  "load",
  initializeAuth
);