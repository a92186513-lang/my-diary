// =========================
// My Diary - Supabase DB
// E2EE 지원
// =========================

const PHOTO_BUCKET =
  "diary-photos";


// =========================
// 현재 로그인 사용자
// =========================

async function getCurrentUser() {

  const {
    data: { user },
    error
  } =
    await supabaseClient.auth
      .getUser();


  if (error) {
    throw error;
  }


  if (!user) {
    throw new Error(
      "로그인이 필요합니다."
    );
  }


  return user;
}


// =========================
// 일기 저장
// =========================

async function saveDiary(diary) {

  const user =
    await getCurrentUser();


  if (!getDiaryCryptoKey()) {

    throw new Error(
      "일기 잠금이 해제되지 않았습니다."
    );
  }


  // 실제로 암호화할 데이터
  const plainData = {

    mood:
      diary.mood || "",

    title:
      diary.title || "",

    content:
      diary.content || "",

    photos:
      diary.photos || []

  };


  // Master Key로 암호화
  const encryptedPayload =
    await encryptDiaryData(
      plainData
    );


  // 저장하기 전에
  // 실제로 다시 풀리는지 확인
  const verify =
    await decryptDiaryData(
      encryptedPayload
    );


  if (
    verify.title !==
      plainData.title ||

    verify.content !==
      plainData.content ||

    verify.mood !==
      plainData.mood
  ) {

    throw new Error(
      "암호화 검증에 실패했습니다."
    );

  }


  const {
    error
  } =
    await supabaseClient
      .from("diaries")
      .upsert(
        {

          user_id:
            user.id,

          diary_date:
            diary.date,

          // ==================
          // 평문은 서버에
          // 남기지 않음
          // ==================

          mood:
            null,

          title:
            null,

          content:
            null,

          photos:
            [],


          // ==================
          // 실제 저장 데이터
          // ==================

          encrypted_payload:
            encryptedPayload,

          encryption_version:
            1,

          updated_at:
            new Date()
              .toISOString()

        },

        {
          onConflict:
            "user_id,diary_date"
        }

      );


  if (error) {

    throw error;

  }


  return true;
}


// =========================
// DB 행 → 앱에서 쓰는 일기
// =========================

async function convertDiaryRow(
  row
) {

  if (!row) {

    return null;

  }


  // =========================
  // 암호화된 새 일기
  // =========================

  if (
    Number(
      row.encryption_version
    ) >= 1 &&
    row.encrypted_payload
  ) {

    const decrypted =
      await decryptDiaryData(
        row.encrypted_payload
      );


    return {

      date:
        row.diary_date,

      mood:
        decrypted.mood || "",

      title:
        decrypted.title || "",

      content:
        decrypted.content || "",

      photos:
        decrypted.photos || [],

      encryptionVersion:
        row.encryption_version

    };

  }


  // =========================
  // 예전 평문 일기
  // 아직 마이그레이션 전
  // =========================

  return {

    date:
      row.diary_date,

    mood:
      row.mood || "",

    title:
      row.title || "",

    content:
      row.content || "",

    photos:
      row.photos || [],

    encryptionVersion:
      0

  };

}


// =========================
// 특정 날짜 일기
// =========================

async function getDiary(date) {

  const user =
    await getCurrentUser();


  const {
    data,
    error
  } =
    await supabaseClient
      .from("diaries")
      .select(
        `
        diary_date,
        mood,
        title,
        content,
        photos,
        encrypted_payload,
        encryption_version
        `
      )
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "diary_date",
        date
      )
      .maybeSingle();


  if (error) {

    throw error;

  }


  return await convertDiaryRow(
    data
  );
}


// =========================
// 모든 일기
// =========================

async function getAllDiaries() {

  const user =
    await getCurrentUser();


  const {
    data,
    error
  } =
    await supabaseClient
      .from("diaries")
      .select(
        `
        diary_date,
        mood,
        title,
        content,
        photos,
        encrypted_payload,
        encryption_version
        `
      )
      .eq(
        "user_id",
        user.id
      )
      .order(
        "diary_date",
        {
          ascending:
            false
        }
      );


  if (error) {

    throw error;

  }


  const diaries = [];


  for (
    const row of data || []
  ) {

    const diary =
      await convertDiaryRow(
        row
      );

    diaries.push(
      diary
    );

  }


  return diaries;
}


// =========================
// 사진 업로드
//
// 주의:
// 현재는 아직 원본 사진 업로드.
// 다음 단계에서 사진 자체도
// AES-GCM으로 암호화할 예정.
// =========================

async function uploadDiaryPhoto(
  file,
  date
) {

  const user =
    await getCurrentUser();


  const originalName =
    file.name || "photo";


  const extension =
    originalName.includes(".")
      ? originalName
          .split(".")
          .pop()
      : "jpg";


  const randomName =
    crypto.randomUUID();


  const path =
    `${user.id}/${date}/${randomName}.${extension}`;


  const {
    error
  } =
    await supabaseClient.storage
      .from(
        PHOTO_BUCKET
      )
      .upload(
        path,
        file,
        {
          contentType:
            file.type ||
            "application/octet-stream",

          upsert:
            false
        }
      );


  if (error) {

    throw error;

  }


  return {

    path:
      path,

    name:
      originalName,

    type:
      file.type,

    size:
      file.size

  };
}


// =========================
// 사진 임시 URL
// =========================

async function getSignedPhotoUrl(
  path
) {

  if (!path) {

    return null;

  }


  const {
    data,
    error
  } =
    await supabaseClient.storage
      .from(
        PHOTO_BUCKET
      )
      .createSignedUrl(
        path,
        3600
      );


  if (error) {

    throw error;

  }


  return data.signedUrl;
}


// =========================
// 사진 삭제
// =========================

async function deleteDiaryPhotos(
  paths
) {

  if (
    !paths ||
    paths.length === 0
  ) {

    return;

  }


  const validPaths =
    paths
      .map(item => {

        if (
          typeof item ===
          "string"
        ) {

          return item;

        }

        return item?.path;

      })
      .filter(Boolean);


  if (
    validPaths.length === 0
  ) {

    return;

  }


  const {
    error
  } =
    await supabaseClient.storage
      .from(
        PHOTO_BUCKET
      )
      .remove(
        validPaths
      );


  if (error) {

    throw error;

  }

}


// =========================
// 일기 삭제
// =========================

async function deleteDiary(
  date
) {

  const user =
    await getCurrentUser();


  // 먼저 사진 목록 확인
  const diary =
    await getDiary(
      date
    );


  const photoPaths =
    (diary?.photos || [])
      .map(
        photo =>
          photo?.path
      )
      .filter(Boolean);


  // DB 삭제
  const {
    error
  } =
    await supabaseClient
      .from("diaries")
      .delete()
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "diary_date",
        date
      );


  if (error) {

    throw error;

  }


  // 연결된 사진 삭제
  if (
    photoPaths.length > 0
  ) {

    await deleteDiaryPhotos(
      photoPaths
    );

  }


  return true;
}