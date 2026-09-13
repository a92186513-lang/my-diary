// =========================
// My Diary - Supabase DB
// E2EE + 암호화 사진
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


  // Master Key로 일기 전체 암호화
  const encryptedPayload =
    await encryptDiaryData(
      plainData
    );


  // 저장 전 복호화 검증
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


          // 평문 제거
          mood:
            null,

          title:
            null,

          content:
            null,

          photos:
            [],


          // 암호문
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
// DB 행 → 앱용 일기
// =========================

async function convertDiaryRow(row) {

  if (!row) {

    return null;

  }


  // 암호화된 일기
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


  // 과거 평문 일기
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


  const diaries =
    [];


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
// 새 사진
// 기기에서 AES-GCM 암호화 후
// Supabase에 .bin으로 업로드
// =========================

async function uploadDiaryPhoto(
  file,
  date
) {

  const user =
    await getCurrentUser();


  const key =
    getDiaryCryptoKey();


  if (!key) {

    throw new Error(
      "일기 잠금이 해제되지 않았습니다."
    );

  }


  // 원본 사진을 메모리로 읽기
  const originalBuffer =
    await file.arrayBuffer();


  // 매 사진마다 새로운 IV
  const iv =
    crypto.getRandomValues(
      new Uint8Array(12)
    );


  // 사진 자체 암호화
  const encryptedBuffer =
    await crypto.subtle.encrypt(
      {
        name:
          "AES-GCM",

        iv:
          iv
      },

      key,

      originalBuffer
    );


  // 암호문만 Blob으로 만듦
  const encryptedBlob =
    new Blob(
      [
        encryptedBuffer
      ],
      {
        type:
          "application/octet-stream"
      }
    );


  // 날짜나 원래 파일명도
  // Storage 경로에서 제거
  const path =
    `${user.id}/${crypto.randomUUID()}.bin`;


  const {
    error
  } =
    await supabaseClient.storage
      .from(
        PHOTO_BUCKET
      )
      .upload(
        path,
        encryptedBlob,
        {
          contentType:
            "application/octet-stream",

          upsert:
            false
        }
      );


  if (error) {

    throw error;

  }


  // 이 정보들은 나중에
  // encrypted_payload 안에 들어가므로
  // 평문 DB에는 노출되지 않음
  return {

    path:
      path,

    iv:
      bytesToBase64(
        iv
      ),

    name:
      file.name ||
      "photo",

    type:
      file.type ||
      "image/jpeg",

    size:
      file.size,

    encrypted:
      true,

    version:
      1

  };
}


// =========================
// 과거 평문 사진용 Signed URL
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
// 사진 표시
//
// 새 사진:
// .bin 다운로드 → 기기에서 복호화
//
// 과거 사진:
// 기존 Signed URL 사용
// =========================

async function getDiaryPhotoUrl(
  photo
) {

  if (
    !photo ||
    !photo.path
  ) {

    return null;

  }


  // =====================
  // 기존 평문 사진
  // =====================

  if (
    !photo.encrypted ||
    !photo.iv
  ) {

    return await getSignedPhotoUrl(
      photo.path
    );

  }


  // =====================
  // 암호화된 새 사진
  // =====================

  const key =
    getDiaryCryptoKey();


  if (!key) {

    throw new Error(
      "일기 잠금이 해제되지 않았습니다."
    );

  }


  const {
    data,
    error
  } =
    await supabaseClient.storage
      .from(
        PHOTO_BUCKET
      )
      .download(
        photo.path
      );


  if (error) {

    throw error;

  }


  const encryptedBuffer =
    await data.arrayBuffer();


  const iv =
    base64ToBytes(
      photo.iv
    );


  let decryptedBuffer;


  try {

    decryptedBuffer =
      await crypto.subtle.decrypt(
        {
          name:
            "AES-GCM",

          iv:
            iv
        },

        key,

        encryptedBuffer
      );


  } catch (error) {

    console.error(
      "사진 복호화 실패:",
      error
    );


    throw new Error(
      "사진을 복호화할 수 없습니다."
    );

  }


  // 브라우저에서만 사용되는
  // 임시 이미지 Blob
  const photoBlob =
    new Blob(
      [
        decryptedBuffer
      ],
      {
        type:
          photo.type ||
          "image/jpeg"
      }
    );


  return URL.createObjectURL(
    photoBlob
  );
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


  if (
    photoPaths.length > 0
  ) {

    await deleteDiaryPhotos(
      photoPaths
    );

  }


  return true;
}

// ========================================
// 기존 평문 일기 → E2EE 마이그레이션
// ========================================

async function encryptLegacyPhoto(photo) {

  if (!photo?.path) {
    return null;
  }


  // 이미 암호화된 사진이면 그대로 사용
  if (
    photo.encrypted === true &&
    photo.iv
  ) {

    return {
      newPhoto: photo,
      oldPath: null
    };

  }


  const key =
    getDiaryCryptoKey();


  if (!key) {

    throw new Error(
      "일기 잠금이 해제되지 않았습니다."
    );

  }


  // 기존 원본 사진 다운로드
  const {
    data,
    error
  } =
    await supabaseClient.storage
      .from(PHOTO_BUCKET)
      .download(photo.path);


  if (error) {
    throw error;
  }


  const originalBuffer =
    await data.arrayBuffer();


  // 새로운 IV
  const iv =
    crypto.getRandomValues(
      new Uint8Array(12)
    );


  // 기기에서 암호화
  const encryptedBuffer =
    await crypto.subtle.encrypt(
      {
        name: "AES-GCM",
        iv: iv
      },
      key,
      originalBuffer
    );


  const encryptedBlob =
    new Blob(
      [encryptedBuffer],
      {
        type:
          "application/octet-stream"
      }
    );


  const user =
    await getCurrentUser();


  // 기존 날짜/파일명 노출하지 않음
  const newPath =
    `${user.id}/${crypto.randomUUID()}.bin`;


  const {
    error: uploadError
  } =
    await supabaseClient.storage
      .from(PHOTO_BUCKET)
      .upload(
        newPath,
        encryptedBlob,
        {
          contentType:
            "application/octet-stream",

          upsert:
            false
        }
      );


  if (uploadError) {
    throw uploadError;
  }


  return {

    newPhoto: {

      path:
        newPath,

      iv:
        bytesToBase64(iv),

      name:
        photo.name ||
        "photo",

      type:
        photo.type ||
        "image/jpeg",

      size:
        photo.size ||
        originalBuffer.byteLength,

      encrypted:
        true,

      version:
        1

    },


    // 나중에 안전하게 삭제할
    // 기존 평문 사진 경로
    oldPath:
      photo.path

  };

}


// ========================================
// 기존 일기 1개 변환
// ========================================

async function migrateOneLegacyDiary(
  row
) {

  const user =
    await getCurrentUser();


  const newPhotos = [];

  const oldPhotoPaths = [];


  // ------------------------
  // 기존 사진부터
  // 암호화된 복사본 생성
  // ------------------------

  for (
    const photo of
    row.photos || []
  ) {

    const result =
      await encryptLegacyPhoto(
        photo
      );


    if (!result) {
      continue;
    }


    newPhotos.push(
      result.newPhoto
    );


    if (result.oldPath) {

      oldPhotoPaths.push(
        result.oldPath
      );

    }

  }


  // ------------------------
  // 기존 평문 일기 내용
  // ------------------------

  const plainData = {

    mood:
      row.mood || "",

    title:
      row.title || "",

    content:
      row.content || "",

    photos:
      newPhotos,


    // 만약 중간에 앱이 종료돼도
    // 다음 실행 때 원본 사진을
    // 정리할 수 있게 암호문 안에 기록
    migrationCleanup: {

      pending:
        oldPhotoPaths.length > 0,

      oldPhotoPaths:
        oldPhotoPaths

    }

  };


  // 전체 일기 암호화
  const encryptedPayload =
    await encryptDiaryData(
      plainData
    );


  // 실제 복호화 테스트
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
      `${row.diary_date} 암호화 검증 실패`
    );

  }


  // ------------------------
  // DB를 암호화 버전으로 전환
  // ------------------------

  const {
    error
  } =
    await supabaseClient
      .from("diaries")
      .update({

        mood:
          null,

        title:
          null,

        content:
          null,

        photos:
          [],

        encrypted_payload:
          encryptedPayload,

        encryption_version:
          1,

        updated_at:
          new Date()
            .toISOString()

      })
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "diary_date",
        row.diary_date
      );


  if (error) {
    throw error;
  }


  // ------------------------
  // DB에서 다시 가져와
  // 복호화되는지 최종 확인
  // ------------------------

  const {
    data: savedRow,
    error: readError
  } =
    await supabaseClient
      .from("diaries")
      .select(
        `
        diary_date,
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
        row.diary_date
      )
      .single();


  if (readError) {
    throw readError;
  }


  const savedDiary =
    await decryptDiaryData(
      savedRow.encrypted_payload
    );


  if (
    savedDiary.title !==
      plainData.title ||

    savedDiary.content !==
      plainData.content
  ) {

    throw new Error(
      `${row.diary_date} 저장 검증 실패`
    );

  }


  // ------------------------
  // 여기까지 성공했을 때만
  // 기존 평문 사진 삭제
  // ------------------------

  if (
    oldPhotoPaths.length > 0
  ) {

    const {
      error: deleteError
    } =
      await supabaseClient.storage
        .from(PHOTO_BUCKET)
        .remove(
          oldPhotoPaths
        );


    if (deleteError) {

      console.warn(
        "기존 사진 삭제 보류:",
        deleteError
      );


      // 삭제 실패여도
      // 암호화 데이터 자체는 안전하게 저장됨.
      // 다음 실행에서 재시도 가능.

      return {
        migrated: true,
        cleanupPending: true
      };

    }

  }


  // ------------------------
  // 기존 사진 삭제 완료 후
  // cleanup 정보도 제거
  // ------------------------

  delete plainData
    .migrationCleanup;


  const finalPayload =
    await encryptDiaryData(
      plainData
    );


  const {
    error: finalError
  } =
    await supabaseClient
      .from("diaries")
      .update({

        encrypted_payload:
          finalPayload,

        updated_at:
          new Date()
            .toISOString()

      })
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "diary_date",
        row.diary_date
      );


  if (finalError) {
    throw finalError;
  }


  return {
    migrated: true,
    cleanupPending: false
  };

}


// ========================================
// 중간에 남은 평문 사진 정리
// ========================================

async function cleanupMigratedDiary(
  row
) {

  if (
    !row.encrypted_payload
  ) {
    return;
  }


  const user =
    await getCurrentUser();


  const decrypted =
    await decryptDiaryData(
      row.encrypted_payload
    );


  const cleanup =
    decrypted
      .migrationCleanup;


  if (
    !cleanup?.pending ||
    !cleanup.oldPhotoPaths?.length
  ) {

    return;
  }


  const {
    error
  } =
    await supabaseClient.storage
      .from(PHOTO_BUCKET)
      .remove(
        cleanup.oldPhotoPaths
      );


  if (error) {

    console.warn(
      "기존 사진 정리 재시도 실패:",
      error
    );

    return;

  }


  delete decrypted
    .migrationCleanup;


  const cleanedPayload =
    await encryptDiaryData(
      decrypted
    );


  const {
    error: updateError
  } =
    await supabaseClient
      .from("diaries")
      .update({

        encrypted_payload:
          cleanedPayload,

        updated_at:
          new Date()
            .toISOString()

      })
      .eq(
        "user_id",
        user.id
      )
      .eq(
        "diary_date",
        row.diary_date
      );


  if (updateError) {
    throw updateError;
  }

}


// ========================================
// 사용자의 전체 과거 기록 이전
// ========================================

async function migrateLegacyDiaries(
  onProgress
) {

  const user =
    await getCurrentUser();


  if (!getDiaryCryptoKey()) {

    throw new Error(
      "일기 잠금이 해제되지 않았습니다."
    );

  }


  // 원본 DB 행 그대로 가져오기
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
          ascending: true
        }
      );


  if (error) {
    throw error;
  }


  const rows =
    data || [];


  let migratedCount = 0;


  for (
    let i = 0;
    i < rows.length;
    i++
  ) {

    const row =
      rows[i];


    if (
      typeof onProgress ===
      "function"
    ) {

      onProgress({
        current:
          i + 1,

        total:
          rows.length,

        date:
          row.diary_date
      });

    }


    // ----------------------
    // 아직 평문인 일기
    // ----------------------

    if (
      Number(
        row.encryption_version
      ) === 0 ||
      !row.encrypted_payload
    ) {

      await migrateOneLegacyDiary(
        row
      );


      migratedCount++;

      continue;

    }


    // ----------------------
    // 이미 이전됐지만
    // 예전 원본 사진 삭제가
    // 남은 경우 정리
    // ----------------------

    await cleanupMigratedDiary(
      row
    );

  }


  return {

    total:
      rows.length,

    migrated:
      migratedCount

  };

}