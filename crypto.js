// =========================
// My Diary 암호화
// =========================

const textEncoder = new TextEncoder();
const textDecoder = new TextDecoder();

let diaryCryptoKey = null;


// =========================
// Base64 변환
// =========================

function bytesToBase64(bytes) {

  let binary = "";

  bytes.forEach(byte => {
    binary += String.fromCharCode(byte);
  });

  return btoa(binary);
}


function base64ToBytes(base64) {

  const binary =
    atob(base64);

  const bytes =
    new Uint8Array(binary.length);

  for (
    let i = 0;
    i < binary.length;
    i++
  ) {

    bytes[i] =
      binary.charCodeAt(i);

  }

  return bytes;
}


// =========================
// 비밀번호 → AES 키
// =========================

async function deriveDiaryKey(
  password,
  salt,
  iterations
) {

  const passwordKey =
    await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(password),
      "PBKDF2",
      false,
      ["deriveKey"]
    );


  return await crypto.subtle.deriveKey(
    {
      name: "PBKDF2",
      salt: salt,
      iterations: iterations,
      hash: "SHA-256"
    },

    passwordKey,

    {
      name: "AES-GCM",
      length: 256
    },

    false,

    [
      "encrypt",
      "decrypt"
    ]
  );
}


// =========================
// 텍스트 암호화
// =========================

async function encryptText(
  text,
  key
) {

  const iv =
    crypto.getRandomValues(
      new Uint8Array(12)
    );


  const encrypted =
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },

      key,

      textEncoder.encode(text)
    );


  return {

    iv:
      bytesToBase64(iv),

    ciphertext:
      bytesToBase64(
        new Uint8Array(encrypted)
      )

  };
}


// =========================
// 텍스트 복호화
// =========================

async function decryptText(
  payload,
  key
) {

  const iv =
    base64ToBytes(
      payload.iv
    );


  const encrypted =
    base64ToBytes(
      payload.ciphertext
    );


  const decrypted =
    await crypto.subtle.decrypt(
      {
        name: "AES-GCM",
        iv: iv
      },

      key,

      encrypted
    );


  return textDecoder.decode(
    decrypted
  );
}


// =========================
// 현재 암호화 키
// =========================

function getDiaryCryptoKey() {

  return diaryCryptoKey;
}


// =========================
// 암호 프로필 확인
// =========================

async function getCryptoProfile(
  userId
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from("crypto_profiles")
      .select("*")
      .eq(
        "user_id",
        userId
      )
      .maybeSingle();


  if (error) {
    throw error;
  }


  return data;
}


// =========================
// 최초 암호 생성
// =========================

async function createDiaryPassword(
  user,
  password
) {

  const salt =
    crypto.getRandomValues(
      new Uint8Array(16)
    );


  const iterations =
    310000;


  const key =
    await deriveDiaryKey(
      password,
      salt,
      iterations
    );


  // 비밀번호가 맞는지
  // 나중에 확인하기 위한 데이터
  const checkPayload =
    await encryptText(
      "MY_DIARY_KEY_CHECK_V1",
      key
    );


  const {
    error
  } =
    await supabaseClient
      .from("crypto_profiles")
      .insert({
        user_id:
          user.id,

        salt_b64:
          bytesToBase64(salt),

        check_payload:
          checkPayload,

        kdf_iterations:
          iterations
      });


  if (error) {
    throw error;
  }


  diaryCryptoKey =
    key;


  return true;
}


// =========================
// 기존 암호로 잠금 해제
// =========================

async function unlockDiary(
  user,
  password
) {

  const profile =
    await getCryptoProfile(
      user.id
    );


  if (!profile) {

    throw new Error(
      "암호화 설정을 찾을 수 없습니다."
    );

  }


  const salt =
    base64ToBytes(
      profile.salt_b64
    );


  const key =
    await deriveDiaryKey(
      password,
      salt,
      profile.kdf_iterations
    );


  try {

    const checkText =
      await decryptText(
        profile.check_payload,
        key
      );


    if (
      checkText !==
      "MY_DIARY_KEY_CHECK_V1"
    ) {

      return false;

    }


    diaryCryptoKey =
      key;


    return true;


  } catch {

    return false;

  }
}


// =========================
// 로그아웃 시 키 제거
// =========================

function clearDiaryCryptoKey() {

  diaryCryptoKey =
    null;

}

// =========================
// 암호 화면 동작
// =========================

async function prepareCryptoScreen(
  session
) {

  const cryptoTitle =
    document.getElementById(
      "cryptoTitle"
    );

  const cryptoDescription =
    document.getElementById(
      "cryptoDescription"
    );

  const passwordInput =
    document.getElementById(
      "cryptoPassword"
    );

  const confirmInput =
    document.getElementById(
      "cryptoPasswordConfirm"
    );

  const cryptoButton =
    document.getElementById(
      "cryptoButton"
    );

  const cryptoMessage =
    document.getElementById(
      "cryptoMessage"
    );


  passwordInput.value =
    "";

  confirmInput.value =
    "";

  cryptoMessage.textContent =
    "";


  const profile =
    await getCryptoProfile(
      session.user.id
    );


  // =====================
  // 최초 사용자
  // =====================

  if (!profile) {

    cryptoTitle.textContent =
      "일기 암호 만들기";

    cryptoDescription.innerHTML =
      `
        이 암호로 당신의 일기와 사진을 보호합니다.<br>
        운영자도 암호를 알 수 없습니다.
      `;

    confirmInput.style.display =
      "block";


    cryptoButton.onclick =
      async () => {

        const password =
          passwordInput.value;

        const confirmPassword =
          confirmInput.value;


        if (
          password.length < 8
        ) {

          cryptoMessage.textContent =
            "암호는 최소 8자 이상으로 만들어주세요.";

          return;
        }


        if (
          password !==
          confirmPassword
        ) {

          cryptoMessage.textContent =
            "두 암호가 서로 다릅니다.";

          return;
        }


        cryptoButton.disabled =
          true;

        cryptoButton.textContent =
          "설정 중...";


        try {

          await createDiaryPassword(
            session.user,
            password
          );


          showDiary(
            session
          );


        } catch (error) {

          console.error(error);

          cryptoMessage.textContent =
            "암호 설정 중 문제가 발생했습니다.";

        } finally {

          cryptoButton.disabled =
            false;

          cryptoButton.textContent =
            "계속";

        }

      };

  }


  // =====================
  // 이미 암호가 있는 사용자
  // =====================

  else {

    cryptoTitle.textContent =
      "일기 잠금 해제";

    cryptoDescription.innerHTML =
      `
        일기 암호를 입력하세요.<br>
        암호는 서버로 전송되지 않습니다.
      `;

    confirmInput.style.display =
      "none";


    cryptoButton.onclick =
      async () => {

        const password =
          passwordInput.value;


        if (!password) {

          cryptoMessage.textContent =
            "일기 암호를 입력해주세요.";

          return;
        }


        cryptoButton.disabled =
          true;

        cryptoButton.textContent =
          "확인 중...";


        try {

          const success =
            await unlockDiary(
              session.user,
              password
            );


          if (!success) {

            cryptoMessage.textContent =
              "암호가 올바르지 않습니다.";

            return;
          }


          showDiary(
            session
          );


        } catch (error) {

          console.error(error);

          cryptoMessage.textContent =
            "잠금 해제 중 문제가 발생했습니다.";

        } finally {

          cryptoButton.disabled =
            false;

          cryptoButton.textContent =
            "계속";

        }

      };

  }

}