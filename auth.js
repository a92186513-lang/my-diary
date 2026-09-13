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
        detectSessionInUrl: true
      }
    }
  );


// =========================
// HTML 요소
// =========================

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
// 로그인 화면
// =========================

function showLogin() {

  loginScreen.style.display =
    "flex";

  cryptoScreen.style.display =
    "none";

  diaryApp.style.display =
    "none";

}


// =========================
// 암호 화면
// =========================

function showCryptoScreen() {

  loginScreen.style.display =
    "none";

  cryptoScreen.style.display =
    "flex";

  diaryApp.style.display =
    "none";

}


// =========================
// 일기 메인 화면
// =========================

async function showDiary(session) {

  loginScreen.style.display =
    "none";

  cryptoScreen.style.display =
    "none";

  diaryApp.style.display =
    "block";


  if (session?.user?.email) {

    userEmail.textContent =
      session.user.email;

  }


  if (
    typeof refreshHome ===
    "function"
  ) {

    await refreshHome();

  }

}


// =========================
// 로그인 성공한 사용자 처리
// =========================

async function handleLoggedInUser(
  session
) {

  if (
    !session ||
    !session.user
  ) {

    showLogin();

    return;

  }


  console.log(
    "로그인 성공:",
    session.user.email
  );


  // Google 로그인 성공 후
  // 반드시 일기 암호 화면으로 이동
  showCryptoScreen();


  if (
    typeof prepareCryptoScreen ===
    "function"
  ) {

    try {

      await prepareCryptoScreen(
        session
      );

    } catch (error) {

      console.error(
        "암호 화면 오류:",
        error
      );

      alert(
        "일기 잠금 화면을 불러오지 못했습니다."
      );

    }

  } else {

    console.error(
      "crypto.js의 prepareCryptoScreen을 찾을 수 없습니다."
    );

  }

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


    try {

      const redirectUrl =
        window.location.origin +
        window.location.pathname;


      console.log(
        "돌아올 주소:",
        redirectUrl
      );


      const {
        error
      } =
        await supabaseClient
          .auth
          .signInWithOAuth({

            provider: "google",

            options: {

              redirectTo:
                redirectUrl

            }

          });


      if (error) {

        throw error;

      }


    } catch (error) {

      console.error(
        "Google 로그인 오류:",
        error
      );


      alert(
        "Google 로그인에 실패했습니다.\n" +
        error.message
      );


      googleLoginBtn.disabled =
        false;

      googleLoginBtn.textContent =
        "G  Google로 계속하기";

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


    const {
      error
    } =
      await supabaseClient
        .auth
        .signOut();


    if (error) {

      console.error(error);

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
// 처음 앱 열었을 때
// 기존 로그인 확인
// =========================

async function initializeAuth() {

  console.log(
    "기존 로그인 상태 확인"
  );


  try {

    const {
      data: { session },
      error
    } =
      await supabaseClient
        .auth
        .getSession();


    if (error) {

      throw error;

    }


    console.log(
      "현재 세션:",
      session
    );


    if (session) {

      await handleLoggedInUser(
        session
      );

    } else {

      showLogin();

    }


  } catch (error) {

    console.error(
      "세션 확인 오류:",
      error
    );

    showLogin();

  }

}


// =========================
// 로그인 상태 변화 감지
// =========================

supabaseClient.auth.onAuthStateChange(
  (event, session) => {

    console.log(
      "Supabase Auth:",
      event
    );


    // Google 로그인 완료
    if (
      event === "SIGNED_IN" &&
      session
    ) {

      // auth callback 안에서
      // 바로 DB 요청하지 않고
      // 다음 실행 순서로 넘김
      setTimeout(
        () => {

          handleLoggedInUser(
            session
          );

        },
        0
      );

      return;

    }


    // 이미 로그인된 상태로 앱 시작
    if (
      event === "INITIAL_SESSION" &&
      session
    ) {

      setTimeout(
        () => {

          handleLoggedInUser(
            session
          );

        },
        0
      );

      return;

    }


    // 로그아웃
    if (
      event === "SIGNED_OUT"
    ) {

      showLogin();

    }

  }
);


// =========================
// 시작
// =========================

window.addEventListener(
  "load",
  initializeAuth
);