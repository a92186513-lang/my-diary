// =========================
// Supabase 설정
// =========================

const SUPABASE_URL =
  "https://dpupbhznbbdbobbuuopp.supabase.co";

const SUPABASE_KEY =
  "PUBLISHABLE_KEY=sb_publishable_couA8z5b6tBRmrF1xoZJAA_ISxiVATJ";


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


// 중복 실행 방지
let authProcessing = false;


// =========================
// 화면 표시
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


  // 로그인 + 일기 잠금 해제 이후에만
  // 실제 일기를 불러옴
  if (
    typeof refreshHome === "function"
  ) {

    await refreshHome();

  }
}


// =========================
// 로그인된 사용자 처리
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
        "암호 화면 준비 오류:",
        error
      );

      alert(
        "일기 잠금 화면을 불러오지 못했습니다."
      );

    }

  } else {

    console.error(
      "prepareCryptoScreen 함수를 찾을 수 없습니다. crypto.js를 확인하세요."
    );

  }
}


// =========================
// Google 로그인
// =========================

googleLoginBtn.addEventListener(
  "click",
  async () => {

    if (authProcessing) {
      return;
    }

    authProcessing = true;

    googleLoginBtn.disabled = true;

    googleLoginBtn.textContent =
      "Google 로그인 중...";


    try {

      const redirectUrl =
        window.location.origin +
        window.location.pathname;


      console.log(
        "로그인 후 돌아올 주소:",
        redirectUrl
      );


      const {
        error
      } =
        await supabaseClient.auth
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


      authProcessing = false;

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
      await supabaseClient.auth
        .signOut();


    if (error) {

      console.error(error);

      alert(
        "로그아웃에 실패했습니다."
      );

      return;
    }


    userEmail.textContent = "";

    showLogin();

  }
);


// =========================
// 앱 최초 실행
// =========================

async function initializeAuth() {

  console.log(
    "로그인 상태 확인 시작"
  );


  try {

    const {
      data: { session },
      error
    } =
      await supabaseClient.auth
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
      "로그인 확인 오류:",
      error
    );

    showLogin();

  } finally {

    authProcessing = false;

    googleLoginBtn.disabled =
      false;

    googleLoginBtn.textContent =
      "G  Google로 계속하기";

  }

}


// =========================
// 로그인 상태 변화 감지
// =========================

supabaseClient.auth.onAuthStateChange(
  (event, session) => {

    console.log(
      "Auth 상태:",
      event
    );


    if (
      event === "SIGNED_OUT"
    ) {

      showLogin();

    }

  }
);


// =========================
// 페이지 전체 로딩 후 실행
// =========================

window.addEventListener(
  "load",
  initializeAuth
);