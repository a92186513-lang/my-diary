// =========================
// HTML 요소
// =========================

const homeScreen =
  document.getElementById("homeScreen");

const editorScreen =
  document.getElementById("editorScreen");

const calendarTitle =
  document.getElementById("calendarTitle");

const calendarDays =
  document.getElementById("calendarDays");

const prevMonthButton =
  document.getElementById("prevMonth");

const nextMonthButton =
  document.getElementById("nextMonth");

const todayWriteButton =
  document.getElementById("todayWriteBtn");

const recentList =
  document.getElementById("recentList");

const entryCount =
  document.getElementById("entryCount");

const backButton =
  document.getElementById("backBtn");

const editorDate =
  document.getElementById("editorDate");

const titleInput =
  document.getElementById("title");

const contentInput =
  document.getElementById("content");

const moodButtons =
  document.querySelectorAll(".mood");

const photoInput =
  document.getElementById("photoInput");

const photoPreview =
  document.getElementById("photoPreview");

const saveButton =
  document.getElementById("saveBtn");

const deleteButton =
  document.getElementById("deleteBtn");


// =========================
// 상태
// =========================

const today =
  new Date();

let calendarYear =
  today.getFullYear();

let calendarMonth =
  today.getMonth();

let selectedDateKey =
  "";

let selectedMood =
  "";


// cloud 사진 + 새로 선택한 사진
let selectedPhotos =
  [];


// 기존 클라우드 사진 중
// 사용자가 X를 누른 사진
let removedPhotoPaths =
  [];


// 로컬 미리보기 URL
let previewUrls =
  [];


// =========================
// 날짜
// =========================

function makeDateKey(
  year,
  month,
  day
) {

  const formattedMonth =
    String(
      month + 1
    ).padStart(
      2,
      "0"
    );


  const formattedDay =
    String(
      day
    ).padStart(
      2,
      "0"
    );


  return (
    `${year}-${formattedMonth}-${formattedDay}`
  );

}


function getTodayKey() {

  return makeDateKey(
    today.getFullYear(),
    today.getMonth(),
    today.getDate()
  );

}


// =========================
// 화면 전환
// =========================

function showHome() {

  editorScreen.classList.remove(
    "active"
  );

  homeScreen.classList.add(
    "active"
  );

}


function showEditor() {

  homeScreen.classList.remove(
    "active"
  );

  editorScreen.classList.add(
    "active"
  );

}


// =========================
// 날짜 표시
// =========================

function showEditorDate(
  dateKey
) {

  const [
    year,
    month,
    day
  ] =
    dateKey
      .split("-")
      .map(Number);


  const date =
    new Date(
      year,
      month - 1,
      day
    );


  editorDate.textContent =
    date.toLocaleDateString(
      "ko-KR",
      {
        year:
          "numeric",

        month:
          "long",

        day:
          "numeric",

        weekday:
          "long"
      }
    );

}


// =========================
// 기분 선택
// =========================

moodButtons.forEach(
  button => {

    button.addEventListener(
      "click",
      () => {

        moodButtons.forEach(
          btn => {

            btn.classList.remove(
              "selected"
            );

          }
        );


        button.classList.add(
          "selected"
        );


        selectedMood =
          button.textContent.trim();

      }
    );

  }
);


// =========================
// 사진 선택
// 압축 없음
// 개수 제한 없음
// =========================

photoInput.addEventListener(
  "change",
  () => {

    const files =
      Array.from(
        photoInput.files
      );


    for (
      const file
      of files
    ) {

      if (
        !file.type.startsWith(
          "image/"
        )
      ) {

        continue;
      }


      selectedPhotos.push({

        source:
          "local",

        file:
          file,

        name:
          file.name,

        type:
          file.type,

        size:
          file.size

      });

    }


    renderPhotoPreview();


    photoInput.value =
      "";

  }
);


// =========================
// 사진 미리보기
// =========================

function renderPhotoPreview() {

  // 이전에 만든
  // 임시 URL 정리
  previewUrls.forEach(
    url => {

      URL.revokeObjectURL(
        url
      );

    }
  );


  previewUrls =
    [];


  photoPreview.innerHTML =
    "";


  selectedPhotos.forEach(
    (photo, index) => {

      const item =
        document.createElement(
          "div"
        );


      item.className =
        "photo-item";


      const img =
        document.createElement(
          "img"
        );


      // 새로 선택한 로컬 사진
      if (
        photo.source ===
        "local"
      ) {

        const url =
          URL.createObjectURL(
            photo.file
          );


        previewUrls.push(
          url
        );


        img.src =
          url;

      }

      // 이미 클라우드에 있는 사진
      else {

        img.src =
          photo.url || "";

      }


      img.alt =
        photo.name ||
        "일기 사진";


      const removeButton =
        document.createElement(
          "button"
        );


      removeButton.className =
        "photo-remove";


      removeButton.textContent =
        "×";


      removeButton.setAttribute(
        "aria-label",
        "사진 삭제"
      );


      removeButton.addEventListener(
        "click",
        () => {

          // 이미 클라우드에 있는 사진이라면
          // 저장 버튼 누를 때 삭제하기 위해 기억
          if (
            photo.source ===
            "cloud" &&
            photo.path
          ) {

            removedPhotoPaths.push(
              photo.path
            );

          }


          selectedPhotos.splice(
            index,
            1
          );


          renderPhotoPreview();

        }
      );


      item.appendChild(
        img
      );


      item.appendChild(
        removeButton
      );


      photoPreview.appendChild(
        item
      );

    }
  );

}


// =========================
// 작성창 초기화
// =========================

function clearEditor() {

  titleInput.value =
    "";

  contentInput.value =
    "";

  selectedMood =
    "";

  selectedPhotos =
    [];

  removedPhotoPaths =
    [];


  moodButtons.forEach(
    button => {

      button.classList.remove(
        "selected"
      );

    }
  );


  renderPhotoPreview();


  deleteButton.classList.add(
    "hidden"
  );

}


// =========================
// 일기 열기
// =========================

async function openEditor(
  dateKey
) {

  selectedDateKey =
    dateKey;


  clearEditor();


  showEditorDate(
    dateKey
  );


  try {

    const diary =
      await getDiary(
        dateKey
      );


    if (diary) {

      titleInput.value =
        diary.title || "";


      contentInput.value =
        diary.content || "";


      selectedMood =
        diary.mood || "";


      moodButtons.forEach(
        button => {

          if (
            button.textContent.trim() ===
            selectedMood
          ) {

            button.classList.add(
              "selected"
            );

          }

        }
      );


      // =====================
      // 클라우드 사진 불러오기
      // =====================

      const cloudPhotos =
        [];


      for (
        const photo
        of diary.photos || []
      ) {

        const signedUrl =
          await getDiaryPhotoUrl(
            photo
          );
         


        cloudPhotos.push({

          source:
            "cloud",

          name:
            photo.name,

          path:
            photo.path,

          type:
            photo.type,

          size:
            photo.size,

          url:
            signedUrl

        });

      }


      selectedPhotos =
        cloudPhotos;


      renderPhotoPreview();


      deleteButton.classList.remove(
        "hidden"
      );

    }


  } catch (error) {

    console.error(
      "일기 열기 오류:",
      error
    );

  }


  showEditor();


  window.scrollTo({
    top: 0
  });

}


// =========================
// 저장
// =========================

saveButton.addEventListener(
  "click",
  async () => {

    const title =
      titleInput
        .value
        .trim();


    const content =
      contentInput
        .value
        .trim();


    if (
      !title &&
      !content &&
      !selectedMood &&
      selectedPhotos.length === 0
    ) {

      alert(
        "기록할 내용을 입력해주세요."
      );

      return;

    }


    // 저장 중 중복 클릭 방지
    saveButton.disabled =
      true;


    const originalButtonText =
      saveButton.textContent;


    saveButton.textContent =
      "저장 중...";


    // 이번 저장에서
    // 새로 업로드한 사진
    const uploadedPhotos =
      [];


    try {

      // =====================
      // 기존 클라우드 사진
      // =====================

      const existingPhotos =
        selectedPhotos

          .filter(
            photo =>
              photo.source ===
              "cloud"
          )

          .map(
  photo => ({
    name:
      photo.name,

    path:
      photo.path,

    type:
      photo.type,

    size:
      photo.size,

    iv:
      photo.iv,

    encrypted:
      photo.encrypted,

    version:
      photo.version
  })
);


      // =====================
      // 새 사진 업로드
      // =====================

      const localPhotos =
        selectedPhotos.filter(
          photo =>
            photo.source ===
            "local"
        );


      // 원본 그대로
      // 한 장씩 업로드
      for (
        const photo
        of localPhotos
      ) {

        const uploaded =
          await uploadDiaryPhoto(
            photo.file,
            selectedDateKey
          );


        uploadedPhotos.push(
          uploaded
        );

      }


      // =====================
      // 최종 사진 목록
      // =====================

      const finalPhotos =
        [
          ...existingPhotos,
          ...uploadedPhotos
        ];


      // =====================
      // 일기 DB 저장
      // =====================

      await saveDiary({

        date:
          selectedDateKey,

        mood:
          selectedMood,

        title:
          title,

        content:
          content,

        photos:
          finalPhotos

      });


      // =====================
      // 사용자가 X 누른
      // 기존 사진 삭제
      // =====================

      if (
        removedPhotoPaths.length >
        0
      ) {

        try {

          await deleteDiaryPhotos(
            removedPhotoPaths
          );

        } catch (error) {

          console.warn(
            "일기는 저장됐지만 일부 삭제 사진 정리에 실패했습니다.",
            error
          );

        }

      }


      alert(
        "기록이 클라우드에 저장되었습니다. ☁️"
      );


      // 저장 완료된 상태
      // 다시 불러오기
      await openEditor(
        selectedDateKey
      );


    } catch (error) {

      console.error(
        "저장 오류:",
        error
      );


      // 일기 저장 자체가 실패했다면
      // 이번에 업로드한 사진 정리
      if (
        uploadedPhotos.length >
        0
      ) {

        try {

          await deleteDiaryPhotos(

            uploadedPhotos.map(
              photo =>
                photo.path
            )

          );

        } catch (
          cleanupError
        ) {

          console.error(
            "업로드 사진 정리 오류:",
            cleanupError
          );

        }

      }


      alert(
        "저장 중 문제가 발생했습니다.\n인터넷 연결과 Supabase 설정을 확인해주세요."
      );


    } finally {

      saveButton.disabled =
        false;


      saveButton.textContent =
        originalButtonText;

    }

  }
);


// =========================
// 일기 삭제
// =========================

deleteButton.addEventListener(
  "click",
  async () => {

    const confirmed =
      confirm(
        "이 기록과 사진을 모두 삭제할까요?\n삭제한 기록은 되돌릴 수 없습니다."
      );


    if (!confirmed) {
      return;
    }


    try {

      await deleteDiary(
        selectedDateKey
      );


      clearEditor();


      await refreshHome();


      showHome();


      alert(
        "기록이 삭제되었습니다."
      );


    } catch (error) {

      console.error(
        "삭제 오류:",
        error
      );


      alert(
        "삭제 중 문제가 발생했습니다."
      );

    }

  }
);


// =========================
// 달력
// =========================

async function renderCalendar() {

  const yearToRender =
    calendarYear;

  const monthToRender =
    calendarMonth;


  let diaries = [];

  try {

    diaries =
      await getAllDiaries();

  } catch (error) {

    console.error(
      "달력 불러오기 오류:",
      error
    );

  }


  // 중요!
  // 데이터를 다 불러온 다음에
  // 기존 달력을 지우고 새로 그림
  calendarDays.innerHTML = "";


  calendarTitle.textContent =
    `${yearToRender}년 ${monthToRender + 1}월`;


  const firstDay =
    new Date(
      yearToRender,
      monthToRender,
      1
    ).getDay();


  const lastDate =
    new Date(
      yearToRender,
      monthToRender + 1,
      0
    ).getDate();


  const diaryDates =
    new Set(
      diaries.map(
        diary => diary.date
      )
    );


  // 월 시작 전 빈칸
  for (
    let i = 0;
    i < firstDay;
    i++
  ) {

    const empty =
      document.createElement("div");

    empty.className =
      "empty-day";

    calendarDays.appendChild(
      empty
    );

  }


  // 날짜 만들기
  for (
    let day = 1;
    day <= lastDate;
    day++
  ) {

    const button =
      document.createElement(
        "button"
      );


    button.className =
      "calendar-day";


    button.textContent =
      day;


    const dateKey =
      makeDateKey(
        yearToRender,
        monthToRender,
        day
      );


    // 오늘
    if (
      dateKey === getTodayKey()
    ) {

      button.classList.add(
        "today"
      );

    }


    // 일기 있는 날짜
    if (
      diaryDates.has(dateKey)
    ) {

      button.classList.add(
        "has-diary"
      );

    }


    // 날짜 클릭
    button.addEventListener(
      "click",
      () => {

        openEditor(
          dateKey
        );

      }
    );


    calendarDays.appendChild(
      button
    );

  }

}


// =========================
// 최근 기록
// =========================

async function renderRecent() {

  let diaries = [];

  try {

    diaries =
      await getAllDiaries();

  } catch (error) {

    console.error(
      "최근 기록 불러오기 오류:",
      error
    );

  }


  // 데이터를 가져온 뒤 초기화
  recentList.innerHTML = "";


  entryCount.textContent =
    `${diaries.length}개의 기록`;


  if (
    diaries.length === 0
  ) {

    recentList.innerHTML =
      `
        <div class="empty-message">
          아직 작성한 기록이 없어요.<br>
          오늘의 첫 기록을 남겨보세요.
        </div>
      `;

    return;

  }


  diaries.sort(
    (a, b) =>
      b.date.localeCompare(
        a.date
      )
  );


  const recentDiaries =
    diaries.slice(
      0,
      5
    );


  recentDiaries.forEach(
    diary => {

      const button =
        document.createElement(
          "button"
        );


      button.className =
        "recent-item";


      const mood =
        diary.mood || "•";


      const title =
        diary.title ||
        "제목 없는 기록";


      const date =
        diary.date.replaceAll(
          "-",
          "."
        );


      button.innerHTML =
        `
          <div class="recent-mood">
            ${mood}
          </div>

          <div class="recent-text">

            <div class="recent-title">
              ${escapeHtml(title)}
            </div>

            <div class="recent-date">
              ${date}
            </div>

          </div>
        `;


      button.addEventListener(
        "click",
        () => {

          openEditor(
            diary.date
          );

        }
      );


      recentList.appendChild(
        button
      );

    }
  );

}


// =========================
// HTML 안전 처리
// =========================

function escapeHtml(
  text
) {

  const div =
    document.createElement(
      "div"
    );


  div.textContent =
    text;


  return div.innerHTML;

}


// =========================
// 이전 달
// =========================

prevMonthButton.addEventListener(
  "click",
  async () => {

    calendarMonth--;


    if (
      calendarMonth < 0
    ) {

      calendarMonth =
        11;

      calendarYear--;

    }


    await renderCalendar();

  }
);


// =========================
// 다음 달
// =========================

nextMonthButton.addEventListener(
  "click",
  async () => {

    calendarMonth++;


    if (
      calendarMonth > 11
    ) {

      calendarMonth =
        0;

      calendarYear++;

    }


    await renderCalendar();

  }
);


// =========================
// 오늘 기록
// =========================

todayWriteButton.addEventListener(
  "click",
  () => {

    openEditor(
      getTodayKey()
    );

  }
);


// =========================
// 뒤로가기
// =========================

backButton.addEventListener(
  "click",
  async () => {

    await refreshHome();


    showHome();


    window.scrollTo({
      top: 0
    });

  }
);


// =========================
// 홈 갱신
// =========================

async function refreshHome() {

  await renderCalendar();

  await renderRecent();

}



