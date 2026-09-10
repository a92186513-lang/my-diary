// =========================
// Supabase 설정
// =========================

const SUPABASE_URL =
  "https://dpupbhznbbdbobbuuopp.supabase.co";

const SUPABASE_KEY =
  "sb_publishable_couA8z5b6tBRmrF1xoZJAA_ISxiVATJ";


// Supabase 연결
const supabaseClient =
  window.supabase.createClient(
    SUPABASE_URL,
    SUPABASE_KEY
  );


// =========================
// HTML 요소
// =========================

const loginScreen =
  document.getElementById("loginScreen");

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

  loginScreen.style.display = "flex";

  diaryApp.style.display = "none";

}


// =========================
// 일기 화면 + 이메일 표시
// =========================

async function showDiary(session) {

  loginScreen.style.display = "none";

  diaryApp.style.display = "block";


  let email = session?.user?.email;


  // 혹시 session에서 이메일을 못 찾으면
  // Supabase에서 사용자 정보를 다시 가져옴
  if (!email) {

    const {
      data: { user },
      error
    } =
      await supabaseClient.auth.getUser();


    if (error) {
      console.error(
        "사용자 정보 오류:",
        error
      );
    }


    email =
      user?.email ||
      user?.user_metadata?.email ||
      "";

  }


  console.log(
    "로그인한 이메일:",
    email
  );


  if (email) {

    userEmail.textContent =
      email;

  } else {

    userEmail.textContent =
      "Google 로그인 완료";

  }

}


// =========================
// Google 로그인
// =========================

googleLoginBtn.addEventListener(
  "click",
  async () => {

    const {
      data,
      error
    } =
      await supabaseClient.auth.signInWithOAuth({

        provider: "google",

        options: {

          redirectTo:
            window.location.origin + window.location.pathname

        }

      });


    if (error) {

      console.error(
        "Google 로그인 오류:",
        error
      );

      alert(
        "Google 로그인 중 문제가 발생했습니다.\n" +
        error.message
      );

    }

  }
);


// =========================
// 로그아웃
// =========================

logoutBtn.addEventListener(
  "click",
  async () => {

    const {
      error
    } =
      await supabaseClient.auth.signOut();


    if (error) {

      console.error(error);

      alert(
        "로그아웃 중 문제가 발생했습니다."
      );

      return;

    }


    userEmail.textContent = "";

    showLogin();

  }
);


// =========================
// 현재 로그인 상태 확인
// =========================

async function checkLogin() {

  const {
    data: { session },
    error
  } =
    await supabaseClient.auth.getSession();


  if (error) {

    console.error(
      "세션 확인 오류:",
      error
    );

  }


  console.log(
    "현재 로그인 세션:",
    session
  );


  if (session) {

    await showDiary(
      session
    );

  } else {

    showLogin();

  }

}


// =========================
// 로그인 상태 변경 감지
// =========================

supabaseClient.auth.onAuthStateChange(
  async (
    event,
    session
  ) => {

    console.log(
      "로그인 상태:",
      event
    );


    if (session) {

      await showDiary(
        session
      );

    } else {

      showLogin();

    }

  }
);


// 앱 시작
checkLogin();