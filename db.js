// =========================
// 현재 로그인 사용자
// =========================

async function getCurrentUser() {

  const {
    data: { session },
    error
  } =
    await supabaseClient.auth.getSession();


  if (error) {

    console.error(
      "로그인 정보 확인 오류:",
      error
    );

    return null;
  }


  return session?.user || null;
}


// =========================
// 일기 저장 / 수정
// =========================

async function saveDiary(diary) {

  const user =
    await getCurrentUser();


  if (!user) {

    throw new Error(
      "로그인이 필요합니다."
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

          mood:
            diary.mood || "",

          title:
            diary.title || "",

          content:
            diary.content || "",

          photos:
            diary.photos || [],

          updated_at:
            new Date().toISOString()
        },
        {
          onConflict:
            "user_id,diary_date"
        }
      );


  if (error) {

    console.error(
      "일기 저장 오류:",
      error
    );

    throw error;
  }

}


// =========================
// 특정 날짜 일기
// =========================

async function getDiary(date) {

  const user =
    await getCurrentUser();


  if (!user) {
    return null;
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("diaries")
      .select("*")
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

    console.error(
      "일기 불러오기 오류:",
      error
    );

    throw error;
  }


  if (!data) {
    return null;
  }


  return {

    date:
      data.diary_date,

    mood:
      data.mood || "",

    title:
      data.title || "",

    content:
      data.content || "",

    photos:
      data.photos || []

  };

}


// =========================
// 전체 일기
// =========================

async function getAllDiaries() {

  const user =
    await getCurrentUser();


  if (!user) {
    return [];
  }


  const {
    data,
    error
  } =
    await supabaseClient
      .from("diaries")
      .select(
        "diary_date, mood, title, content, photos, updated_at"
      )
      .eq(
        "user_id",
        user.id
      )
      .order(
        "diary_date",
        {
          ascending: false
        }
      );


  if (error) {

    console.error(
      "전체 일기 불러오기 오류:",
      error
    );

    throw error;
  }


  return (
    data || []
  ).map(
    diary => ({

      date:
        diary.diary_date,

      mood:
        diary.mood || "",

      title:
        diary.title || "",

      content:
        diary.content || "",

      photos:
        diary.photos || []

    })
  );

}


// =========================
// 원본 사진 업로드
// =========================

async function uploadDiaryPhoto(
  file,
  date
) {

  const user =
    await getCurrentUser();


  if (!user) {

    throw new Error(
      "로그인이 필요합니다."
    );

  }


  // 원본 파일 확장자 가져오기
  let extension = "";

  if (
    file.name &&
    file.name.includes(".")
  ) {

    extension =
      file.name
        .split(".")
        .pop()
        .toLowerCase()
        .replace(
          /[^a-z0-9]/g,
          ""
        );

  }


  // 같은 이름 사진 충돌 방지
  let uniqueId;

  if (
    window.crypto &&
    crypto.randomUUID
  ) {

    uniqueId =
      crypto.randomUUID();

  } else {

    uniqueId =
      `${Date.now()}-${Math.random()
        .toString(36)
        .slice(2)}`;

  }


  const storageFileName =
    extension
      ? `${uniqueId}.${extension}`
      : uniqueId;


  // 사용자ID / 날짜 / 파일
  const path =
    `${user.id}/${date}/${storageFileName}`;


  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from(
        "diary-photos"
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

    console.error(
      "사진 업로드 오류:",
      error
    );

    throw error;
  }


  return {

    name:
      file.name,

    path:
      data.path,

    type:
      file.type,

    size:
      file.size

  };

}


// =========================
// 비공개 사진 보기용 주소
// =========================

async function getSignedPhotoUrl(
  path
) {

  const {
    data,
    error
  } =
    await supabaseClient
      .storage
      .from(
        "diary-photos"
      )
      .createSignedUrl(
        path,
        3600
      );


  if (error) {

    console.error(
      "사진 주소 생성 오류:",
      error
    );

    return null;
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


  const {
    error
  } =
    await supabaseClient
      .storage
      .from(
        "diary-photos"
      )
      .remove(
        paths
      );


  if (error) {

    console.error(
      "사진 삭제 오류:",
      error
    );

    throw error;
  }

}


// =========================
// 일기 전체 삭제
// 글 + 사진
// =========================

async function deleteDiary(date) {

  const user =
    await getCurrentUser();


  if (!user) {

    throw new Error(
      "로그인이 필요합니다."
    );

  }


  // 삭제 전에 사진 목록 확인
  const diary =
    await getDiary(date);


  const photoPaths =
    (diary?.photos || [])
      .map(
        photo => photo.path
      )
      .filter(Boolean);


  // 먼저 일기 DB 삭제
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

    console.error(
      "일기 삭제 오류:",
      error
    );

    throw error;
  }


  // 연결된 사진도 삭제
  if (
    photoPaths.length > 0
  ) {

    try {

      await deleteDiaryPhotos(
        photoPaths
      );

    } catch (error) {

      console.warn(
        "일기는 삭제됐지만 일부 사진 삭제에 실패했습니다.",
        error
      );

    }

  }

}