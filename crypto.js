// =========================
// My Diary E2EE
// Master Key + Recovery Key
// =========================

const textEncoder =
  new TextEncoder();

const textDecoder =
  new TextDecoder();

const KDF_ITERATIONS =
  310000;

const V1_CHECK_TEXT =
  "MY_DIARY_KEY_CHECK_V1";

const V2_CHECK_TEXT =
  "MY_DIARY_KEY_CHECK_V2";


// 실제 일기를 여는 Master Key
// 메모리에만 존재
let diaryCryptoKey =
  null;


// =========================
// Base64
// =========================

function bytesToBase64(bytes) {

  let binary = "";

  const chunkSize =
    0x8000;

  for (
    let i = 0;
    i < bytes.length;
    i += chunkSize
  ) {

    const chunk =
      bytes.subarray(
        i,
        i + chunkSize
      );

    binary +=
      String.fromCharCode(
        ...chunk
      );

  }

  return btoa(binary);
}


function base64ToBytes(base64) {

  const binary =
    atob(base64);

  const bytes =
    new Uint8Array(
      binary.length
    );

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
// Base64 URL
// 복구키용
// =========================

function bytesToBase64Url(bytes) {

  return bytesToBase64(bytes)
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}


function base64UrlToBytes(value) {

  let normalized =
    value
      .replace(/\s/g, "")
      .replace(/-/g, "+")
      .replace(/_/g, "/");


  while (
    normalized.length % 4
  ) {

    normalized += "=";

  }


  return base64ToBytes(
    normalized
  );
}


function formatRecoveryKey(
  value
) {

  return (
    value.match(/.{1,5}/g)
      ?.join(" ") ||
    value
  );

}


// =========================
// 난수
// =========================

function randomBytes(length) {

  return crypto.getRandomValues(
    new Uint8Array(length)
  );

}


// =========================
// 비밀번호 → 키
// =========================

async function derivePasswordKey(
  password,
  salt,
  iterations
) {

  const material =
    await crypto.subtle.importKey(
      "raw",
      textEncoder.encode(
        password
      ),
      "PBKDF2",
      false,
      [
        "deriveKey"
      ]
    );


  return crypto.subtle.deriveKey(

    {
      name:
        "PBKDF2",

      salt:
        salt,

      iterations:
        iterations,

      hash:
        "SHA-256"
    },

    material,

    {
      name:
        "AES-GCM",

      length:
        256
    },

    false,

    [
      "encrypt",
      "decrypt"
    ]

  );

}


// =========================
// Raw 32byte → AES Key
// =========================

async function importAesKey(
  rawBytes
) {

  return crypto.subtle.importKey(
    "raw",
    rawBytes,
    {
      name:
        "AES-GCM"
    },
    false,
    [
      "encrypt",
      "decrypt"
    ]
  );

}


// =========================
// Bytes 암호화
// =========================

async function encryptBytes(
  bytes,
  key
) {

  const iv =
    randomBytes(12);


  const encrypted =
    await crypto.subtle.encrypt(

      {
        name:
          "AES-GCM",

        iv:
          iv
      },

      key,

      bytes

    );


  return {

    iv:
      bytesToBase64(iv),

    ciphertext:
      bytesToBase64(
        new Uint8Array(
          encrypted
        )
      )

  };

}


// =========================
// Bytes 복호화
// =========================

async function decryptBytes(
  payload,
  key
) {

  const iv =
    base64ToBytes(
      payload.iv
    );

  const ciphertext =
    base64ToBytes(
      payload.ciphertext
    );


  const decrypted =
    await crypto.subtle.decrypt(

      {
        name:
          "AES-GCM",

        iv:
          iv
      },

      key,

      ciphertext

    );


  return new Uint8Array(
    decrypted
  );

}


// =========================
// Text 암호화
// =========================

async function encryptText(
  text,
  key
) {

  return encryptBytes(
    textEncoder.encode(
      text
    ),
    key
  );

}


// =========================
// Text 복호화
// =========================

async function decryptText(
  payload,
  key
) {

  const bytes =
    await decryptBytes(
      payload,
      key
    );


  return textDecoder.decode(
    bytes
  );

}


// =========================
// Master Key 가져오기
// =========================

function getDiaryCryptoKey() {

  return diaryCryptoKey;

}


// =========================
// 로그아웃 시 Master Key 제거
// =========================

function clearDiaryCryptoKey() {

  diaryCryptoKey =
    null;

}


// =========================
// 프로필 가져오기
// =========================

async function getCryptoProfile(
  userId
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "crypto_profiles"
      )
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
// V2 신규 암호 생성
// =========================

async function createV2Profile(
  user,
  password
) {

  const salt =
    randomBytes(16);


  // 실제 일기용 랜덤 Master Key
  const masterKeyBytes =
    randomBytes(32);


  // 사용자에게 전달할 Recovery Key
  const recoveryKeyBytes =
    randomBytes(32);


  const passwordKey =
    await derivePasswordKey(
      password,
      salt,
      KDF_ITERATIONS
    );


  const recoveryKey =
    await importAesKey(
      recoveryKeyBytes
    );


  // Master Key를 비밀번호로 잠금
  const passwordWrappedKey =
    await encryptBytes(
      masterKeyBytes,
      passwordKey
    );


  // 같은 Master Key를 복구키로도 잠금
  const recoveryWrappedKey =
    await encryptBytes(
      masterKeyBytes,
      recoveryKey
    );


  // 비밀번호 검증용
  const checkPayload =
    await encryptText(
      V2_CHECK_TEXT,
      passwordKey
    );


  const {
    error
  } =
    await supabaseClient
      .from(
        "crypto_profiles"
      )
      .insert({

        user_id:
          user.id,

        salt_b64:
          bytesToBase64(
            salt
          ),

        check_payload:
          checkPayload,

        kdf_iterations:
          KDF_ITERATIONS,

        password_wrapped_key:
          passwordWrappedKey,

        recovery_wrapped_key:
          recoveryWrappedKey,

        crypto_version:
          2

      });


  if (error) {

    throw error;

  }


  diaryCryptoKey =
    await importAesKey(
      masterKeyBytes
    );


  const recoveryString =
    bytesToBase64Url(
      recoveryKeyBytes
    );


  return formatRecoveryKey(
    recoveryString
  );

}


// =========================
// 기존 V1 암호 확인
// =========================

async function verifyV1Password(
  profile,
  password
) {

  try {

    const salt =
      base64ToBytes(
        profile.salt_b64
      );


    const passwordKey =
      await derivePasswordKey(
        password,
        salt,
        profile.kdf_iterations
      );


    const check =
      await decryptText(
        profile.check_payload,
        passwordKey
      );


    return (
      check ===
      V1_CHECK_TEXT
    );


  } catch {

    return false;

  }

}


// =========================
// V1 → V2 업그레이드
// =========================

async function upgradeV1ToV2(
  user,
  profile,
  password
) {

  const valid =
    await verifyV1Password(
      profile,
      password
    );


  if (!valid) {

    return {
      success: false
    };

  }


  const salt =
    base64ToBytes(
      profile.salt_b64
    );


  const passwordKey =
    await derivePasswordKey(
      password,
      salt,
      profile.kdf_iterations
    );


  const masterKeyBytes =
    randomBytes(32);


  const recoveryKeyBytes =
    randomBytes(32);


  const recoveryKey =
    await importAesKey(
      recoveryKeyBytes
    );


  const passwordWrappedKey =
    await encryptBytes(
      masterKeyBytes,
      passwordKey
    );


  const recoveryWrappedKey =
    await encryptBytes(
      masterKeyBytes,
      recoveryKey
    );


  const checkPayload =
    await encryptText(
      V2_CHECK_TEXT,
      passwordKey
    );


  const {
    error
  } =
    await supabaseClient
      .from(
        "crypto_profiles"
      )
      .update({

        check_payload:
          checkPayload,

        password_wrapped_key:
          passwordWrappedKey,

        recovery_wrapped_key:
          recoveryWrappedKey,

        crypto_version:
          2,

        updated_at:
          new Date()
            .toISOString()

      })
      .eq(
        "user_id",
        user.id
      );


  if (error) {

    throw error;

  }


  diaryCryptoKey =
    await importAesKey(
      masterKeyBytes
    );


  return {

    success: true,

    recoveryKey:
      formatRecoveryKey(
        bytesToBase64Url(
          recoveryKeyBytes
        )
      )

  };

}


// =========================
// V2 일반 암호로 잠금 해제
// =========================

async function unlockV2(
  profile,
  password
) {

  try {

    const salt =
      base64ToBytes(
        profile.salt_b64
      );


    const passwordKey =
      await derivePasswordKey(
        password,
        salt,
        profile.kdf_iterations
      );


    const masterKeyBytes =
      await decryptBytes(
        profile.password_wrapped_key,
        passwordKey
      );


    if (
      masterKeyBytes.length !== 32
    ) {

      return false;

    }


    diaryCryptoKey =
      await importAesKey(
        masterKeyBytes
      );


    return true;


  } catch {

    return false;

  }

}


// =========================
// 복구키 → 새 비밀번호 설정
// =========================

async function recoverWithRecoveryKey(
  user,
  recoveryKeyText,
  newPassword
) {

  try {

    const profile =
      await getCryptoProfile(
        user.id
      );


    if (
      !profile ||
      Number(
        profile.crypto_version
      ) < 2 ||
      !profile.recovery_wrapped_key
    ) {

      return false;

    }


    const recoveryKeyBytes =
      base64UrlToBytes(
        recoveryKeyText
      );


    if (
      recoveryKeyBytes.length !==
      32
    ) {

      return false;

    }


    const recoveryKey =
      await importAesKey(
        recoveryKeyBytes
      );


    // 복구키로 Master Key 복호화
    const masterKeyBytes =
      await decryptBytes(
        profile.recovery_wrapped_key,
        recoveryKey
      );


    // 새 비밀번호용 salt
    const newSalt =
      randomBytes(16);


    const newPasswordKey =
      await derivePasswordKey(
        newPassword,
        newSalt,
        KDF_ITERATIONS
      );


    // Master Key를 새 비밀번호로 다시 잠금
    const newPasswordWrappedKey =
      await encryptBytes(
        masterKeyBytes,
        newPasswordKey
      );


    const newCheckPayload =
      await encryptText(
        V2_CHECK_TEXT,
        newPasswordKey
      );


    const {
      error
    } =
      await supabaseClient
        .from(
          "crypto_profiles"
        )
        .update({

          salt_b64:
            bytesToBase64(
              newSalt
            ),

          kdf_iterations:
            KDF_ITERATIONS,

          password_wrapped_key:
            newPasswordWrappedKey,

          check_payload:
            newCheckPayload,

          updated_at:
            new Date()
              .toISOString()

        })
        .eq(
          "user_id",
          user.id
        );


    if (error) {

      throw error;

    }


    diaryCryptoKey =
      await importAesKey(
        masterKeyBytes
      );


    return true;


  } catch (error) {

    console.error(
      "복구 실패:",
      error
    );

    return false;

  }

}


// =========================
// 다음 단계에서 사용할
// 일기 데이터 암호화 함수
// =========================

async function encryptDiaryData(
  object
) {

  if (!diaryCryptoKey) {

    throw new Error(
      "일기 잠금이 해제되지 않았습니다."
    );

  }


  return encryptText(
    JSON.stringify(object),
    diaryCryptoKey
  );

}


async function decryptDiaryData(
  payload
) {

  if (!diaryCryptoKey) {

    throw new Error(
      "일기 잠금이 해제되지 않았습니다."
    );

  }


  const text =
    await decryptText(
      payload,
      diaryCryptoKey
    );


  return JSON.parse(
    text
  );

}


// =========================
// 복구키 화면 표시
// =========================

function showRecoveryKeyScreen(
  recoveryKey,
  session
) {

  const passwordPanel =
    document.getElementById(
      "passwordPanel"
    );

  const recoveryResetPanel =
    document.getElementById(
      "recoveryResetPanel"
    );

  const recoveryPanel =
    document.getElementById(
      "recoveryPanel"
    );

  const recoveryKeyText =
    document.getElementById(
      "recoveryKeyText"
    );

  const copyButton =
    document.getElementById(
      "copyRecoveryKeyBtn"
    );

  const savedCheck =
    document.getElementById(
      "recoverySavedCheck"
    );

  const continueButton =
    document.getElementById(
      "recoveryContinueBtn"
    );


  passwordPanel.style.display =
    "none";

  recoveryResetPanel.style.display =
    "none";

  recoveryPanel.style.display =
    "block";


  recoveryKeyText.textContent =
    recoveryKey;


  savedCheck.checked =
    false;

  continueButton.disabled =
    true;


  savedCheck.onchange =
    () => {

      continueButton.disabled =
        !savedCheck.checked;

    };


  copyButton.onclick =
    async () => {

      try {

        await navigator.clipboard
          .writeText(
            recoveryKey
          );

        copyButton.textContent =
          "복사됨 ✓";

      } catch {

        alert(
          "복사가 되지 않았습니다. 복구키를 직접 저장해주세요."
        );

      }

    };


  continueButton.onclick =
    () => {

      showDiary(
        session
      );

    };

}


// =========================
// 암호 화면 준비
// =========================

async function prepareCryptoScreen(
  session
) {

  const title =
    document.getElementById(
      "cryptoTitle"
    );

  const description =
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

  const button =
    document.getElementById(
      "cryptoButton"
    );

  const message =
    document.getElementById(
      "cryptoMessage"
    );

  const passwordPanel =
    document.getElementById(
      "passwordPanel"
    );

  const recoveryPanel =
    document.getElementById(
      "recoveryPanel"
    );

  const recoveryModeBtn =
    document.getElementById(
      "recoveryModeBtn"
    );

  const recoveryResetPanel =
    document.getElementById(
      "recoveryResetPanel"
    );


  // 초기화
  passwordInput.value =
    "";

  confirmInput.value =
    "";

  message.textContent =
    "";

  passwordPanel.style.display =
    "block";

  recoveryPanel.style.display =
    "none";

  recoveryResetPanel.style.display =
    "none";

  recoveryModeBtn.style.display =
    "none";


  const profile =
    await getCryptoProfile(
      session.user.id
    );


  // =========================
  // 완전 신규 사용자
  // =========================

  if (!profile) {

    title.textContent =
      "일기 암호 만들기";


    description.innerHTML =
      `
        일기와 사진을 보호할 암호를 만들어주세요.<br>
        암호는 서버에 저장되지 않습니다.
      `;


    confirmInput.style.display =
      "block";


    button.textContent =
      "암호 만들기";


    button.onclick =
      async () => {

        const password =
          passwordInput.value;

        const confirm =
          confirmInput.value;


        if (
          password.length < 12
        ) {

          message.textContent =
            "암호는 최소 12자 이상으로 만들어주세요.";

          return;

        }


        if (
          password !== confirm
        ) {

          message.textContent =
            "두 암호가 서로 다릅니다.";

          return;

        }


        button.disabled =
          true;

        button.textContent =
          "보안 설정 중...";


        try {

          const recoveryKey =
            await createV2Profile(
              session.user,
              password
            );


          showRecoveryKeyScreen(
            recoveryKey,
            session
          );


        } catch (error) {

          console.error(error);

          message.textContent =
            "암호 설정 중 문제가 발생했습니다.";

        } finally {

          button.disabled =
            false;

          button.textContent =
            "암호 만들기";

        }

      };


    return;

  }


  // =========================
  // 기존 V1 사용자
  // =========================

  if (
    Number(
      profile.crypto_version
    ) < 2 ||
    !profile.password_wrapped_key ||
    !profile.recovery_wrapped_key
  ) {

    title.textContent =
      "보안 업그레이드";


    description.innerHTML =
      `
        기존 일기 암호를 입력해주세요.<br>
        새로운 복구키를 발급해드립니다.
      `;


    confirmInput.style.display =
      "none";


    button.textContent =
      "보안 업그레이드";


    button.onclick =
      async () => {

        const password =
          passwordInput.value;


        if (!password) {

          message.textContent =
            "기존 일기 암호를 입력해주세요.";

          return;

        }


        button.disabled =
          true;

        button.textContent =
          "업그레이드 중...";


        try {

          const result =
            await upgradeV1ToV2(
              session.user,
              profile,
              password
            );


          if (!result.success) {

            message.textContent =
              "일기 암호가 올바르지 않습니다.";

            return;

          }


          showRecoveryKeyScreen(
            result.recoveryKey,
            session
          );


        } catch (error) {

          console.error(error);

          message.textContent =
            "보안 업그레이드 중 문제가 발생했습니다.";

        } finally {

          button.disabled =
            false;

          button.textContent =
            "보안 업그레이드";

        }

      };


    return;

  }


  // =========================
  // V2 사용자
  // =========================

  title.textContent =
    "일기 잠금 해제";


  description.innerHTML =
    `
      일기 암호를 입력하세요.<br>
      암호는 서버로 전송되지 않습니다.
    `;


  confirmInput.style.display =
    "none";


  recoveryModeBtn.style.display =
    "block";


  button.textContent =
    "잠금 해제";


  button.onclick =
    async () => {

      const password =
        passwordInput.value;


      if (!password) {

        message.textContent =
          "일기 암호를 입력해주세요.";

        return;

      }


      button.disabled =
        true;

      button.textContent =
        "확인 중...";


      try {

        const success =
          await unlockV2(
            profile,
            password
          );


        if (!success) {

          message.textContent =
            "암호가 올바르지 않습니다.";

          return;

        }


        showDiary(
          session
        );


      } finally {

        button.disabled =
          false;

        button.textContent =
          "잠금 해제";

      }

    };


  // =========================
  // 복구 모드
  // =========================

  recoveryModeBtn.onclick =
    () => {

      passwordPanel.style.display =
        "none";

      recoveryResetPanel.style.display =
        "block";

      message.textContent =
        "";

    };


  const backButton =
    document.getElementById(
      "backToPasswordBtn"
    );


  backButton.onclick =
    () => {

      recoveryResetPanel.style.display =
        "none";

      passwordPanel.style.display =
        "block";

      message.textContent =
        "";

    };


  const resetButton =
    document.getElementById(
      "recoveryResetButton"
    );


  resetButton.onclick =
    async () => {

      const recoveryKey =
        document.getElementById(
          "recoveryKeyInput"
        ).value;


      const newPassword =
        document.getElementById(
          "newDiaryPassword"
        ).value;


      const confirm =
        document.getElementById(
          "newDiaryPasswordConfirm"
        ).value;


      if (!recoveryKey) {

        message.textContent =
          "복구키를 입력해주세요.";

        return;

      }


      if (
        newPassword.length < 12
      ) {

        message.textContent =
          "새 암호는 최소 12자 이상으로 만들어주세요.";

        return;

      }


      if (
        newPassword !== confirm
      ) {

        message.textContent =
          "새 암호가 서로 다릅니다.";

        return;

      }


      resetButton.disabled =
        true;

      resetButton.textContent =
        "복구 중...";


      try {

        const success =
          await recoverWithRecoveryKey(
            session.user,
            recoveryKey,
            newPassword
          );


        if (!success) {

          message.textContent =
            "복구키가 올바르지 않습니다.";

          return;

        }


        alert(
          "새 일기 암호가 설정되었습니다."
        );


        showDiary(
          session
        );


      } finally {

        resetButton.disabled =
          false;

        resetButton.textContent =
          "새 암호 설정";

      }

    };

}