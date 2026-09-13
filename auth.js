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
    SUPABASE_KEY
  );


// =========================
// HTML 요소
// =========================

const loginScreen =
  document.getElementById(
    "loginScreen"
  );

const cryptoScreen =
  document.getElementById(
    "cryptoScreen"
  );

const diaryApp =
  document.getElementById(
    "diaryApp"
  );

const googleLoginBtn =
  document.getElementById(
    "googleLoginBtn"
  );

const logoutBtn =
  document.getElementById(
    "logoutBtn"
  );

const userEmail =
  document.getElementById(
    "userEmail"
  );


// =========================
// 화면
// =========================

function showLogin() {

  loginScreen.style.display =
    "flex";

  cryptoScreen.style.display =
    "none";

  diaryApp.style.display =
    "none";
}


function showCryptoScreen() {

  loginScreen.style.display =
    "none";

  cryptoScreen.style.display =
    "flex";

  diaryApp.style.display =
    "none";
}


function showDiary(
  session
) {

  loginScreen.style.display =
    "none";

  cryptoScreen.style.display =
    "none";

  diaryApp.style.display =
    "block";


  if (
    session?.user?.email
  ) {

    userEmail.textContent =
      session.user.email;

  }


  if (
    typeof refreshHome ===
    "function"
  ) {

    refreshHome();

  }
}


// =========================
// Google 로그인
// =========================

googleLoginBtn.addEventListener(
  "click",
  async () => {

    const {
      error
    } =
      await supabaseClient
        .auth
        .signInWithOAuth({

          provider:
            "google",

          options: {

            redirectTo:
              window.location.origin +
              window.location.pathname

          }

        });


    if (error) {

      alert(
        "Google 로그인 중 문제가 발생했습니다."
      );

      console.error(error);

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


    await supabaseClient
      .auth
      .signOut();


    showLogin();

  }
);


// =========================
// Google 로그인 여부 확인
// =========================

async function checkLogin() {

  const {
    data: { session }
  } =
    await supabaseClient
      .auth
      .getSession();


  if (!session) {

    showLogin();

    return;
  }


  // Google 로그인은 되어 있으므로
  // 이제 일기 암호 화면으로
  showCryptoScreen();


  if (
    typeof prepareCryptoScreen ===
    "function"
  ) {

    await prepareCryptoScreen(
      session
    );

  }

}


// 페이지 로딩이 모두 끝난 뒤 실행
window.addEventListener(
  "load",
  checkLogin
);