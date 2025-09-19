document.addEventListener("DOMContentLoaded", () => {
  // --- UI 요소 및 전역 변수 ---
  const mmlInput = document.getElementById("mml-input");
  const trackInputsContainer = document.getElementById("track-inputs-container");
  const logOutput = document.getElementById("log-output");
  const resultOutput = document.getElementById("result-output");

  const bugFixButton = document.getElementById("bug-fix-button");
  const finalCopyButton = document.getElementById("final-copy-button");
  const resetButton = document.getElementById("reset-button");
  const floatingControls = document.querySelector(".floating-controls");
  const tutorialOverlay = document.getElementById("tutorial-overlay");
  const helpButtonWrapper = document.querySelector(".floating-help-button-wrapper");
  const noticeOverlay = document.getElementById("notice-overlay");
  const noticeButtonWrapper = document.querySelector(".floating-notice-button-wrapper");

  let finalMML = "";
  let isSyncing = false; // 양방향 동기화 무한 루프 방지 플래그
  const DEBOUNCE_DELAY = 500; // 디바운싱 딜레이 (ms)

  // --- 디바운스 유틸리티 함수 ---
  const debounce = (func, delay) => {
    let timeoutId;
    return (...args) => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(() => {
        func.apply(this, args);
      }, delay);
    };
  };

  // --- 로깅 함수 ---
  const appendToLog = (message, type = "info") => {
    const timestamp = new Date().toLocaleTimeString();
    logOutput.value += `[${timestamp}] ${message}\n`;
    logOutput.scrollTop = logOutput.scrollHeight; // 항상 마지막 로그가 보이도록 자동 스크롤
    // TODO: type에 따라 로그 색상 변경 (e.g., logOutput.classList.add(`log-${type}`))
  };

  // --- 유효성 검사 함수 ---
  const validateMMLChars = (mml, isMainInput = false) => {
    // 1. 허용된 문자/패턴 정의
    const allowedChars = "tvolcdefgabr&+#.><n";
    let tempMml = mml.toLowerCase();

    // 2. MML@, ;, , 등 특수 케이스 처리
    if (isMainInput) {
      tempMml = tempMml.replace(/mml@/g, "").replace(/;/g, "").replace(/,/g, "");
    }

    // 3. 허용된 문자, 숫자, 공백 제거
    const invalidChars = tempMml.replace(new RegExp(`[${allowedChars}0-9\\s-]`, "g"), "");

    if (invalidChars.length > 0) {
      // 중복 제거 후 잘못된 문자 목록 반환
      const uniqueInvalidChars = [...new Set(invalidChars.split(""))].join(", ");
      return `허용되지 않는 문자 포함: [${uniqueInvalidChars}]`;
    }
    return null; // 유효함
  };

  // --- 이벤트 리스너 ---
  bugFixButton.addEventListener("click", () => {
    // 로그창 초기화
    logOutput.value = "";
    logOutput.classList.remove("is-error");
    resultOutput.value = "";
    mmlInput.classList.remove("is-invalid");
    document.querySelectorAll(".track-input-wrapper textarea").forEach((ta) => ta.classList.remove("is-invalid"));

    const errors = [];

    // 1. MML 코드 가져오기 및 전처리
    const rawMml = mmlInput.value;

    // 1-1. 문자 유효성 검사
    const mainCharError = validateMMLChars(rawMml, true);
    if (mainCharError) {
      errors.push(`MML코드: ${mainCharError}`);
      mmlInput.classList.add("is-invalid");
    }

    // 1-1. 모든 공백 제거
    let processedMml = rawMml.replace(/\s/g, "");
    // 1-2. 여러 MML 코드가 합쳐진 경우 (';MML@')를 쉼표로 변환
    processedMml = processedMml.replace(/;MML@/gi, ",");

    // 2. MML 형식 검사
    const isValidMml = processedMml.toUpperCase().startsWith("MML@") && processedMml.endsWith(";");

    if (!isValidMml) {
      const errorMessage = rawMml.trim() === "" ? "MML 코드를 입력해주세요." : "MML 형식이 올바르지 않습니다. 'MML@...;' 형식으로 입력해주세요.";
      console.error(errorMessage);

      // 로그 및 결과창에 오류 메시지 표시
      logOutput.value = `[오류] ${errorMessage}`;
      logOutput.classList.add("is-error");

      // 로그창으로 스크롤
      logOutput.scrollIntoView({ behavior: "smooth", block: "end" });

      // 텍스트 박스에 경고 스타일 적용
      mmlInput.classList.add("is-invalid");
      setTimeout(() => {
        mmlInput.classList.remove("is-invalid");
      }, 2000); // 2초 후 경고 스타일 제거

      return;
    }

    // 3. 개별 트랙 유효성 검사
    const trackTextareas = trackInputsContainer.querySelectorAll(".track-input-wrapper textarea");
    trackTextareas.forEach((textarea) => {
      const trackLabel = textarea.previousElementSibling.querySelector("span").textContent.split(" ")[0];
      const trackCharError = validateMMLChars(textarea.value, false);
      if (trackCharError) {
        errors.push(`${trackLabel} 트랙: ${trackCharError}`);
        textarea.classList.add("is-invalid");
      }
    });

    // 4. 에러가 있으면 로그에 출력하고 중단
    if (errors.length > 0) {
      logOutput.value = `[입력 오류]\n- ${errors.join("\n- ")}`;
      logOutput.classList.add("is-error");
      logOutput.scrollIntoView({ behavior: "smooth", block: "end" });
      return;
    }

    // 5. 모든 검사를 통과하면 처리 시작
    bugFixButton.disabled = true;
    bugFixButton.textContent = "⏳ 처리 중...";
    finalMML = "";

    setTimeout(() => {
      try {
        runOptimization(processedMml); // 전처리된 코드를 전달
      } catch (e) {
        console.error("오류 발생:", e.message, e.stack);
        bugFixButton.textContent = "버그 수정";
      } finally {
        bugFixButton.disabled = false;
      }
    }, 50);
  });

  finalCopyButton.addEventListener("click", () => {
    const textToCopy = resultOutput.value;

    if (!textToCopy) {
      appendToLog("📋 복사할 내용이 없습니다.", "warn");
      return;
    }

    navigator.clipboard
      .writeText(textToCopy)
      .then(() => {
        appendToLog("📋 최종 결과가 클립보드에 복사되었습니다.", "success");
      })
      .catch((err) => {
        appendToLog("❌ 클립보드 복사에 실패했습니다. 아래 창에서 직접 복사해주세요.", "error");
        console.error("클립보드 복사 실패:", err);
      });
  });

  resetButton.addEventListener("click", () => {
    // 모든 텍스트 박스 초기화
    mmlInput.value = "";
    trackInputsContainer.innerHTML = "";
    logOutput.value = "";
    resultOutput.value = "";

    // 추가했던 박스들 원래대로
    addTrackInput();

    // 버튼 상태 초기화
    bugFixButton.classList.remove("is-hidden");
    finalCopyButton.classList.add("is-hidden");
    bugFixButton.textContent = "버그 수정";

    // 전역 결과 초기화
    finalMML = "";
    console.log("✨ 모든 입력이 초기화되었습니다.");
  });

  // 메인 MML 입력창의 코드를 개별 트랙으로 분리하고 UI를 업데이트하는 함수
  const syncMmlToTracks = () => {
    if (isSyncing) return;
    isSyncing = true;

    const rawMml = mmlInput.value;

    // 1. 모든 공백 제거
    let processedMml = rawMml.replace(/\s/g, "");
    // 2. 여러 MML 코드가 합쳐진 경우 (';MML@')를 쉼표로 변환
    processedMml = processedMml.replace(/;MML@/gi, ",");

    // 3. MML 형식 검사
    if (processedMml.toUpperCase().startsWith("MML@") && processedMml.endsWith(";")) {
      // 4. MML@ 접두사와 ; 접미사 제거
      const tracksString = processedMml.slice(4, -1);

      // 5. 쉼표를 기준으로 트랙 분리
      const tracks = tracksString.split(",");

      // 6. 개별 트랙 칸을 효율적으로 업데이트 (DOM 파괴 최소화)
      const existingWrappers = trackInputsContainer.querySelectorAll(".track-input-wrapper");
      const numTracks = tracks.length;
      const numExisting = existingWrappers.length;

      // 필요한 만큼 트랙 추가
      for (let i = numExisting; i < numTracks; i++) {
        addTrackInput(false); // 스크롤 없이 추가
      }

      // 남는 트랙 삭제
      for (let i = numExisting - 1; i >= numTracks; i--) {
        existingWrappers[i].remove();
      }

      // 모든 트랙의 내용 업데이트
      const updatedWrappers = trackInputsContainer.querySelectorAll(".track-input-wrapper");
      tracks.forEach((trackContent, index) => {
        if (updatedWrappers[index]) {
          updatedWrappers[index].querySelector("textarea").value = trackContent;
        }
      });

      // UI(라벨, 버튼 등) 최종 업데이트
      updateTrackInputsUI();
    } else {
      // MML 코드가 유효하지 않은 경우, 멜로디 트랙을 제외한 모든 트랙을 삭제하고 내용을 비웁니다.
      trackInputsContainer.innerHTML = ""; // 모든 트랙 칸을 지웁니다.
      addTrackInput(); // 멜로디 트랙 하나를 다시 추가합니다.
    }
    isSyncing = false;
  };

  // 메인 MML 입력창 내용이 변할 때만 개별 트랙을 갱신합니다.
  mmlInput.addEventListener("input", debounce(syncMmlToTracks, DEBOUNCE_DELAY));

  // 개별 트랙들의 코드를 메인 MML 입력창에 합쳐서 업데이트하는 함수
  const syncTracksToMml = () => {
    if (isSyncing) return;
    isSyncing = true;

    const trackTextareas = trackInputsContainer.querySelectorAll(".track-input-wrapper textarea");
    const trackContents = Array.from(trackTextareas).map((textarea) => textarea.value);

    // 모든 트랙이 비어있는지 확인
    const allTracksEmpty = trackContents.every((content) => content.trim() === "");

    if (allTracksEmpty) {
      // 모든 트랙이 비어있으면 메인 입력창도 비웁니다.
      mmlInput.value = "";
    } else {
      // 하나라도 내용이 있으면 MML 코드를 생성합니다.
      const combinedTracks = trackContents.join(",");
      const finalMml = `MML@${combinedTracks};`;
      mmlInput.value = finalMml;
    }

    isSyncing = false;
  };

  // 개별 트랙 입력에 대한 디바운스 함수를 미리 생성합니다.
  const debouncedSyncTracksToMml = debounce(syncTracksToMml, DEBOUNCE_DELAY);

  // --- 스크롤에 따른 버튼 관성 효과 로직 ---
  let lastScrollTop = 0;
  let scrollTimeout;
  const scrollOffset = 50; // 버튼이 움직일 거리 (px)

  window.addEventListener("scroll", () => {
    let scrollTop = window.pageYOffset || document.documentElement.scrollTop;

    // 1. 스크롤 방향에 따라 버튼을 반대 방향으로 살짝 움직입니다.
    if (scrollTop > lastScrollTop) {
      floatingControls.style.transform = `translateX(-50%) translateY(-${scrollOffset}px)`;
      noticeButtonWrapper.style.transform = `translateY(-${scrollOffset}px)`;
      helpButtonWrapper.style.transform = `translateY(-${scrollOffset}px)`;
    } else {
      floatingControls.style.transform = `translateX(-50%) translateY(${scrollOffset}px)`;
      noticeButtonWrapper.style.transform = `translateY(${scrollOffset}px)`;
      helpButtonWrapper.style.transform = `translateY(${scrollOffset}px)`;
    }
    lastScrollTop = scrollTop <= 0 ? 0 : scrollTop;

    // 2. 스크롤이 멈추면 버튼을 원래 위치로 되돌립니다.
    clearTimeout(scrollTimeout);
    scrollTimeout = setTimeout(() => {
      floatingControls.style.transform = "translateX(-50%) translateY(0)";
      noticeButtonWrapper.style.transform = "translateY(0)";
      helpButtonWrapper.style.transform = "translateY(0)";
    }, 25); // 25ms 동안 스크롤이 없으면 복귀
  });

  // --- 튜토리얼 로직 ---
  const showTutorial = () => {
    tutorialOverlay.classList.remove("is-hidden");
    setTimeout(() => {
      tutorialOverlay.classList.add("is-visible");
    }, 10); // DOM 렌더링 후 투명도 변경
  };

  const hideTutorial = () => {
    // 1. 사라지는 애니메이션을 위해 transition 스타일을 동적으로 추가
    tutorialOverlay.style.transition = "opacity 1s ease-in-out";
    // 2. is-visible 클래스를 제거하여 opacity를 0으로 만듦 (애니메이션 시작)
    tutorialOverlay.classList.remove("is-visible");
    setTimeout(() => {
      tutorialOverlay.classList.add("is-hidden"); // 3. 애니메이션이 끝난 후 완전히 숨김
      tutorialOverlay.style.transition = ""; // 4. 다음을 위해 transition 스타일 제거
    }, 1000); // transition 시간과 일치 (1초)
  };

  // 현재 탭 세션에서 처음 방문 시에만 튜토리얼 표시 (새로고침 시 다시 보임)
  if (!sessionStorage.getItem("tutorialShown")) {
    // 페이지 진입과 동시에 튜토리얼 표시
    showTutorial();
    sessionStorage.setItem("tutorialShown", "true");
  }

  // 튜토리얼 오버레이 클릭 시 숨기기
  tutorialOverlay.addEventListener("click", hideTutorial);

  // --- 주의사항 로직 ---
  const showNotice = () => {
    noticeOverlay.classList.remove("is-hidden");
    setTimeout(() => noticeOverlay.classList.add("is-visible"), 10);
  };

  const hideNotice = () => {
    noticeOverlay.classList.remove("is-visible");
    setTimeout(() => noticeOverlay.classList.add("is-hidden"), 300); // transition 시간과 일치
  };

  // 주의사항 버튼 클릭 시 창 표시
  noticeButtonWrapper.addEventListener("click", showNotice);
  noticeOverlay.addEventListener("click", hideNotice);

  // 도움말 버튼 클릭 시 튜토리얼 다시 표시
  helpButtonWrapper.addEventListener("click", showTutorial);

  // --- 개별 트랙 입력 UI 로직 ---
  const MAX_TRACKS = 6;

  // UI 상태를 업데이트하는 중앙 함수
  const updateTrackInputsUI = () => {
    const wrappers = Array.from(trackInputsContainer.querySelectorAll(".track-input-wrapper"));
    const trackCount = wrappers.length;

    // 추가 버튼만 제거
    document.querySelectorAll(".add-track-button-wrapper").forEach((btn) => btn.remove());

    // 라벨, ID, 버튼 상태 재정렬
    wrappers.forEach((wrapper, index) => {
      const label = wrapper.querySelector("label");
      const labelTextSpan = label.querySelector("span");
      const textarea = wrapper.querySelector("textarea");
      const deleteButton = wrapper.querySelector(".delete-track-button");

      const trackNum = index + 1;
      const trackLabel = trackNum === 1 ? "멜로디" : `화음 ${trackNum - 1}`;
      const textLength = textarea.value.replace(/\s/g, "").length;
      const placeholderText = trackNum === 1 ? "개별 트랙 입력은 여기에 붙여넣으세요..." : "";

      labelTextSpan.textContent = `${trackLabel} (${textLength})`;

      label.htmlFor = `track-input-${trackNum}`;
      textarea.id = `track-input-${trackNum}`;
      textarea.placeholder = placeholderText;

      // 마지막 트랙이고, 트랙이 2개 이상일 때만 삭제 버튼을 보이게 함 (is-hidden 클래스 제어)
      if (index === trackCount - 1 && trackCount > 1) {
        deleteButton.classList.remove("is-hidden");
      } else {
        deleteButton.classList.add("is-hidden");
      }
    });

    // 트랙이 6개 미만일 때만 추가 버튼 생성
    if (trackCount < MAX_TRACKS) {
      const addButtonWrapper = document.createElement("div");
      addButtonWrapper.className = "add-track-button-wrapper";
      addButtonWrapper.textContent = "+";
      addButtonWrapper.title = "트랙 추가";
      trackInputsContainer.appendChild(addButtonWrapper);
    }
  };

  const addTrackInput = (shouldScroll = true) => {
    const wrapper = document.createElement("div");
    wrapper.className = "track-input-wrapper";
    wrapper.innerHTML = `<label><span></span><button class="delete-track-button is-hidden" title="마지막 트랙 삭제">&times;</button></label><textarea class="track-input"></textarea>`;

    // 렌더링 문제를 피하기 위해, DOM에 추가하기 전에 UI 업데이트를 먼저 수행합니다.
    // 이렇게 하면 버튼이 항상 올바른 크기로 생성됩니다.
    updateTrackInputsUI();
    trackInputsContainer.appendChild(wrapper);
    updateTrackInputsUI();

    // 새로 추가된 '트랙 추가' 버튼으로 부드럽게 스크롤합니다.
    if (shouldScroll) {
      const addButton = trackInputsContainer.querySelector(".add-track-button-wrapper");
      if (addButton) {
        addButton.scrollIntoView({ behavior: "smooth", block: "nearest" });
      }
    }
  };

  // 개별 트랙 컨테이너에 이벤트 위임 적용
  trackInputsContainer.addEventListener("click", (e) => {
    if (e.target.classList.contains("add-track-button-wrapper")) {
      addTrackInput();
      syncTracksToMml();
    } else if (e.target.classList.contains("delete-track-button")) {
      e.target.closest(".track-input-wrapper").remove();
      updateTrackInputsUI();
      syncTracksToMml();
    }
  });

  trackInputsContainer.addEventListener("input", (e) => {
    if (e.target.classList.contains("track-input")) {
      // 글자 수 실시간 업데이트는 즉시, MML 합치기는 디바운싱 적용
      updateTrackInputsUI();
      debouncedSyncTracksToMml();
    }
  });

  // --- 메인 실행 로직 ---
  function runOptimization(mmlCode) {
    try {
      appendToLog("MML 코드 처리 시작...");

      // MML 코드 전처리
      const tracks = preprocessMML(mmlCode);
      const initialTrackLengths = tracks.map((track) => track.length); // 수정 전 트랙 길이 저장
      appendToLog(`총 ${tracks.length}개의 트랙을 발견했습니다.`);

      // 각 트랙 tokenize
      const rawTokenizedTracks = tracks.map((track) => tokenizeTrack(track));

      // 토큰 후처리
      let processedTracks = rawTokenizedTracks.map((tokens) => processTokens(tokens));

      // n_note를 일반 note로 변환하고 옥타브 보정
      processedTracks = processedTracks.map((track) => convertNNoteTokens(track));

      // 템포 변경 정보 생성
      const tempoPoints = findTempoChangePoints(processedTracks);
      appendToLog(`총 ${tempoPoints.length}개의 고유한 템포 변경 지점을 확인했습니다.`);

      // 템포 토큰 삽입
      const tracksWithTempo = insertTempoTokens(processedTracks, tempoPoints);

      // 각 트랙에 시작 템포가 없으면 t120 추가
      normalizeTempoTokens(tracksWithTempo);

      // 트랙 템포 구간별 음표 수 체크
      const tempoSegmentsInfo = analyzeTempoSegments(tracksWithTempo, tempoPoints);
      appendToLog("템포 구간별 음표 개수 분석 완료.");
      // 상세 로그가 필요하면 아래 주석 해제
      // appendToLog(`분석 결과: ${JSON.stringify(tempoSegmentsInfo, null, 2)}`);

      // --- 파이프라인 1 실행 ---
      appendToLog("--- 파이프라인 1 실행 ---");
      console.log("\n--- 파이프라인 1 실행 ---");
      const expandedTracks1 = expandLCommands(tracksWithTempo);
      appendToLog("L 명령어 최적화 해제 완료.");
      const equalizedTracks1 = equalizeNoteCounts1(expandedTracks1, tempoSegmentsInfo);
      appendToLog("템포 구간별 음표 개수를 통일해 버그를 임시로 수정했습니다.(동일 길이 그룹 우선 분할)");
      const optimizedTracks1 = runOptimizationPipeline(equalizedTracks1);
      const { trackStrings: trackStrings1 } = serializeTracks(optimizedTracks1, false); // 최종 MML 생성 안함
      appendToLog("--- 파이프라인 1 실행 완료---");

      // --- 파이프라인 2 실행 ---
      appendToLog("--- 파이프라인 2 실행 ---");
      console.log("\n--- 파이프라인 2 실행 ---");
      const equalizedTracks2 = equalizeNoteCounts2(tracksWithTempo, tempoSegmentsInfo);
      appendToLog("템포 구간별 음표 개수를 통일해 버그를 임시로 수정했습니다.(기존 코드 유지+필요한 부분만 분할)");
      const optimizedTracks2 = runOptimizationPipeline(equalizedTracks2);
      const { trackStrings: trackStrings2 } = serializeTracks(optimizedTracks2, false); // 최종 MML 생성 안함
      appendToLog("--- 파이프라인 2 실행 완료 ---");

      // --- 결과 비교 및 병합 ---
      console.log("--- 결과 비교 및 병합 ---");
      console.log("\n--- 결과 비교 및 병합 ---");
      const finalTrackStrings = [];
      for (let i = 0; i < tracks.length; i++) {
        const track1 = trackStrings1[i] || "";
        const track2 = trackStrings2[i] || "";
        if (track1.length < track2.length) {
          finalTrackStrings.push(track1);
          appendToLog(`트랙 ${i + 1}: 방식 1 선택 (길이: ${track1.length} < ${track2.length})`);
          console.log(`트랙 ${i + 1}: 방식 1 선택 (길이: ${track1.length} < ${track2.length})`);
        } else {
          finalTrackStrings.push(track2);
          appendToLog(`트랙 ${i + 1}: 방식 2 선택 (길이: ${track1.length} >= ${track2.length})`);
          console.log(`트랙 ${i + 1}: 방식 2 선택 (길이: ${track1.length} >= ${track2.length})`);
        }
      }

      finalMML = `MML@${finalTrackStrings.join(",")};`;
      const trackLengths = finalTrackStrings.map((t) => t.length);

      // 최종 결과 저장 및 UI 업데이트
      bugFixButton.classList.add("is-hidden");
      finalCopyButton.classList.remove("is-hidden");

      // 로그 및 결과창에 최종 결과 표시
      appendToLog("========================================");
      appendToLog("✅ 수정이 완료되었습니다.", "success");
      appendToLog("========================================");

      trackLengths.forEach((len, idx) => {
        const beforeLen = initialTrackLengths[idx] ?? "N/A";
        const trackMsg = `${idx + 1}번 트랙 길이: ${beforeLen} -> ${len}`;
        if (len > 1200) {
          appendToLog(`⚠️ ${trackMsg} (1200자 초과! 추가 최적화가 필요할 수 있습니다.)`, "warn");
        } else {
          appendToLog(trackMsg);
        }
      });

      resultOutput.value = finalMML;
      resultOutput.scrollIntoView({ behavior: "smooth", block: "end" });

      // 클립보드에 복사
      navigator.clipboard
        .writeText(finalMML)
        .then(() => {
          appendToLog("📋 결과가 클립보드에 자동으로 복사되었습니다. 인게임에서 붙여넣기 해주세요", "success");
        })
        .catch((err) => {
          appendToLog("❌ 클립보드 복사에 실패했습니다. 코드 복사 버튼을 누르시거나 아래 창에서 직접 복사해주세요.", "error");
          console.error("클립보드 복사 실패:", err);
        });
    } catch (e) {
      appendToLog(`[치명적 오류] 처리 중 예외가 발생했습니다: ${e.message}`, "error");
      logOutput.classList.add("is-error");
      logOutput.scrollIntoView({ behavior: "smooth", block: "end" });
      throw e; // 에러를 다시 던져서 상위 catch 블록에서 처리하도록 함
    }
  }

  // 페이지 로드 시 첫 번째 트랙 입력창 생성 및 초기 동기화
  addTrackInput();
  syncTracksToMml();

  // MML 코드 전처리 함수
  function preprocessMML(mmlString) {
    if (typeof mmlString !== "string") throw new TypeError("mmlString must be a string");

    let s = mmlString.trim();
    if (s.startsWith("MML@") || s.startsWith("mml@")) s = s.slice(4);
    if (s.endsWith(";")) s = s.slice(0, -1);

    return s.split(",");
  }

  // tokenize 함수
  function tokenizeTrack(trackString) {
    const tokens = [];
    let i = 0;

    // 숫자 읽기 헬퍼 함수
    function readNumberAndLength(str, index) {
      let j = index;
      let numStr = "";
      while (j < str.length && /[0-9]/.test(str[j])) {
        numStr += str[j++];
      }
      return { value: numStr ? parseInt(numStr, 10) : null, length: j - index };
    }

    while (i < trackString.length) {
      const ch = trackString[i];
      const lowerCh = ch.toLowerCase();
      const start = i;

      // 1. 공백 건너뛰기
      if (/\s/.test(ch)) {
        i++;
        continue;
      }

      // 2. 'l' 명령어 처리 (점 포함)
      if (lowerCh === "l") {
        let j = i + 1;
        const { length: numLen } = readNumberAndLength(trackString, j);
        if (numLen > 0) {
          j += numLen;
          if (trackString[j] === ".") {
            j++; // 점(.)까지 포함
          }
          tokens.push({
            type: "command",
            raw: trackString.substring(start, j),
          });
          i = j;
          continue;
        }
      }

      // 3. 명령어 (t, v, o)
      if (/[tvo]/i.test(lowerCh)) {
        const { value, length } = readNumberAndLength(trackString, i + 1);
        if (value !== null) {
          tokens.push({
            type: "command",
            raw: trackString.substring(i, i + 1 + length),
          });
          i += 1 + length;
          continue;
        }
      }

      // 4. 타이 (&)
      if (ch === "&") {
        tokens.push({ type: "tie", raw: "&" });
        i++;
        continue;
      }

      // 5. 옥타브 변경 (>, <)
      if (ch === ">" || ch === "<") {
        tokens.push({ type: "octave_shift", raw: ch });
        i++;
        continue;
      }

      // 6. 음표 및 쉼표 (c,d,e,f,g,a,b,n,r)
      if (/[cdefgabnr]/i.test(lowerCh)) {
        const start = i;
        i++;

        // 반음(#, +, -) 처리
        if (/[#\+\-]/.test(trackString[i])) {
          i++;
        }

        let tokenType;

        if (lowerCh === "r") {
          tokenType = "rest";
        } else if (lowerCh === "n") {
          tokenType = "n_note"; // 'n' 음표를 위한 새로운 타입
        } else {
          tokenType = "note"; // c,d,e,f,g,a,b 음표
        }

        // 숫자 부분을 읽고 그 길이(numLen)만큼 파서의 인덱스(i)를 앞으로 이동시킵니다.
        // 이렇게 해야 현재 토큰의 숫자 부분을 건너뛰고 다음 토큰을 올바르게 탐색할 수 있습니다.
        const { length: numLen } = readNumberAndLength(trackString, i);
        i += numLen;

        // 점(.) 처리
        while (trackString[i] === ".") {
          i++;
        }

        tokens.push({ type: tokenType, raw: trackString.substring(start, i) });
        continue;
      }

      // 7. 인식되지 않은 문자
      tokens.push({ type: "unknown", raw: ch });
      i++;
    }

    return tokens;
  }

  // 토큰 후처리
  function processTokens(rawTokens) {
    const processed = [];
    const WHOLE_TICK = 384;
    const DEFAULT_LENGTH = 4;
    const DEFAULT_OCTAVE = 4;

    let currentLength = DEFAULT_LENGTH;
    let defaultLengthHasDot = false;
    let accumulatedTick = 0;
    let currentOctave = DEFAULT_OCTAVE;

    // Helper function to parse numbers from raw token strings
    function extractNumberFromRaw(str) {
      const match = str.match(/[0-9]+/);
      return match ? parseInt(match[0], 10) : null;
    }

    // Tick 계산 헬퍼 함수
    function calculateTick(noteLength, hasDot) {
      let baseTick = Math.floor(WHOLE_TICK / noteLength);
      if (hasDot) {
        baseTick += Math.floor(baseTick / 2);
      }
      return baseTick;
    }

    for (const rawToken of rawTokens) {
      const newToken = { ...rawToken, noteLength: null, hasDot: false, currentTick: 0 };

      switch (rawToken.type) {
        case "command": {
          const command = rawToken.raw.charAt(0).toLowerCase();
          if (command === "o") {
            const value = extractNumberFromRaw(rawToken.raw);
            if (value !== null) {
              currentOctave = value;
            }
          } else if (command === "l") {
            const value = extractNumberFromRaw(rawToken.raw);
            if (value !== null) {
              currentLength = value;
            }
            defaultLengthHasDot = rawToken.raw.includes(".");
          }
          // 'o' 명령어는 자신을 포함하여 이후 토큰들의 옥타브를 변경합니다.
          // 그 외 명령어(t, v, l)는 현재 옥타브 값을 그대로 가집니다.
          break;
        }

        case "tie":
          break;

        case "octave_shift":
          // '>' 또는 '<'를 만나면 옥타브를 먼저 변경하고, 변경된 값을 할당합니다.
          currentOctave += rawToken.raw === ">" ? 1 : -1;
          break;

        case "note":
        case "rest": {
          const explicitLength = extractNumberFromRaw(rawToken.raw);
          const hasExplicitDot = rawToken.raw.includes(".");

          newToken.noteLength = explicitLength !== null ? explicitLength : currentLength;
          newToken.hasDot = hasExplicitDot || (explicitLength === null && defaultLengthHasDot);

          newToken.currentTick = calculateTick(newToken.noteLength, newToken.hasDot);
          break;
        }

        case "n_note": {
          const midiNumber = extractNumberFromRaw(rawToken.raw);
          if (midiNumber !== null) {
            // n_note의 옥타브는 MIDI 숫자를 기반으로 별도 계산합니다.
            // 예: n63 -> floor(63 / 12) = 5옥타브
            newToken.currentOctave = Math.floor(midiNumber / 12);
          }
          newToken.noteLength = currentLength;
          newToken.hasDot = defaultLengthHasDot;

          newToken.currentTick = calculateTick(newToken.noteLength, newToken.hasDot);
          break;
        }

        default:
          // 'unknown' 토큰 등 다른 모든 타입도 현재 옥타브 정보를 가집니다.
          break;
      }

      // switch 문에서 갱신된 옥타브 값을 모든 토큰에 일괄적으로 할당합니다.
      if (newToken.currentOctave === undefined) {
        newToken.currentOctave = currentOctave;
      }
      newToken.accumulatedTick = accumulatedTick; // 토큰의 시작 시점을 저장
      accumulatedTick += newToken.currentTick;

      processed.push(newToken);
    }
    return processed;
  }

  // n음표 일반 음표로 변환
  function midiToPitch(midiNumber) {
    const pitchClasses = ["c", "c+", "d", "d+", "e", "f", "f+", "g", "g+", "a", "a+", "b"];
    const octave = Math.floor(midiNumber / 12);
    const pitchIndex = midiNumber % 12;
    const pitch = pitchClasses[pitchIndex];
    return { pitch, octave };
  }

  // n음표 삭제 및 일반 음표 대체 삽입
  function convertNNoteTokens(track) {
    const newTrack = [];
    const DEFAULT_OCTAVE = 4;

    for (let i = 0; i < track.length; i++) {
      const token = track[i];

      if (token.type !== "n_note") {
        newTrack.push(token);
        continue;
      }

      // 1. n_note를 일반 note 토큰으로 변환
      const midiNumber = parseInt(token.raw.substring(1), 10);
      if (isNaN(midiNumber)) {
        newTrack.push(token); // 변환 불가 시 원본 유지
        continue;
      }

      const { pitch, octave: nNoteOctave } = midiToPitch(midiNumber);

      const newNoteToken = { ...token };
      newNoteToken.type = "note";
      newNoteToken.raw = `${pitch}${token.noteLength}${token.hasDot ? "." : ""}`;
      newNoteToken.currentOctave = nNoteOctave; // 옥타브 정보도 n_note 기준으로 갱신

      // 2. 옥타브 보정 토큰 추가
      const octaveCorrectionTokens = [];

      // 2-1. 앞 토큰과의 옥타브 보정
      let octaveDiffBefore = 0;
      const prevToken = newTrack[newTrack.length - 1];
      let lastOctave = prevToken ? prevToken.currentOctave : DEFAULT_OCTAVE; // 이전 옥타브 상태

      octaveDiffBefore = nNoteOctave - lastOctave;

      if (octaveDiffBefore !== 0) {
        const shiftCharBefore = octaveDiffBefore > 0 ? ">" : "<";
        for (let j = 0; j < Math.abs(octaveDiffBefore); j++) {
          // ❗ FIX: 생성되는 토큰에 필요한 모든 속성을 직접 할당합니다.
          octaveCorrectionTokens.push({
            type: "octave_shift",
            raw: shiftCharBefore,
            noteLength: null,
            hasDot: false,
            currentTick: 0,
            accumulatedTick: token.accumulatedTick, // n_note와 동일한 시작 시간
            currentOctave: lastOctave + (octaveDiffBefore > 0 ? 1 : -1),
          });
          lastOctave += octaveDiffBefore > 0 ? 1 : -1;
        }
      }

      octaveCorrectionTokens.push(newNoteToken);

      // 2-2. n_note 연주 후 원래 옥타브로 복귀
      if (octaveDiffBefore !== 0) {
        const octaveDiffAfter = -octaveDiffBefore;
        const shiftCharAfter = octaveDiffAfter > 0 ? ">" : "<";

        for (let j = 0; j < Math.abs(octaveDiffAfter); j++) {
          // ❗ FIX: 생성되는 토큰에 필요한 모든 속성을 직접 할당합니다.
          octaveCorrectionTokens.push({
            type: "octave_shift",
            raw: shiftCharAfter,
            noteLength: null,
            hasDot: false,
            currentTick: 0,
            accumulatedTick: token.accumulatedTick + token.currentTick, // n_note가 끝난 시간
            currentOctave: lastOctave + (octaveDiffAfter > 0 ? 1 : -1),
          });
          lastOctave += octaveDiffAfter > 0 ? 1 : -1;
        }
      }

      newTrack.push(...octaveCorrectionTokens);
    }

    // ❗ FIX: processTokens 재호출을 제거하여 L 명령어 상태가 초기화되는 것을 방지합니다.
    return newTrack;
  }

  // 템포 변경 정보 생성 함수
  function findTempoChangePoints(processedTracks) {
    const tempoPoints = [];

    function extractNumberFromRaw(str) {
      const match = str.match(/[0-9]+/);
      return match ? parseInt(match[0], 10) : null;
    }

    for (const track of processedTracks) {
      for (const token of track) {
        if (token.raw.toLowerCase().startsWith("t")) {
          const tempoValue = extractNumberFromRaw(token.raw);
          if (tempoValue !== null) {
            const tick = token.accumulatedTick;
            const exists = tempoPoints.some((p) => p.tick === tick && p.tempo === tempoValue);
            if (!exists) {
              tempoPoints.push({ tick: tick, tempo: tempoValue });
            }
          }
        }
      }
    }

    return tempoPoints.sort((a, b) => a.tick - b.tick);
  }

  // 모든 트랙에 템포 삽입(음표 분할 기능 포함)
  function insertTempoTokens(processedTracks, tempoPoints) {
    const newTracks = JSON.parse(JSON.stringify(processedTracks));

    newTracks.forEach((track) => {
      tempoPoints
        .slice()
        .sort((a, b) => b.tick - a.tick)
        .forEach((tp) => {
          const { tick: targetTick, tempo: targetTempo } = tp;

          const alreadyExists = track.some((token) => token.accumulatedTick === targetTick && token.raw.toLowerCase() === `t${targetTempo}`);
          if (alreadyExists) return;

          const newTempoToken = {
            type: "command",
            raw: `t${targetTempo}`,
            noteLength: null,
            hasDot: false,
            currentTick: 0,
            accumulatedTick: targetTick,
          };

          const exactIndex = track.findIndex((token) => token.accumulatedTick === targetTick);
          if (exactIndex !== -1) {
            track.splice(exactIndex, 0, newTempoToken);
            return;
          }

          const splitIndex = track.findIndex((token) => token.accumulatedTick < targetTick && token.accumulatedTick + token.currentTick > targetTick);

          if (splitIndex !== -1) {
            const tokenToSplit = track[splitIndex];

            if (tokenToSplit.type !== "note" && tokenToSplit.type !== "rest") {
              track.splice(splitIndex + 1, 0, newTempoToken);
              return;
            }

            const firstPartTick = targetTick - tokenToSplit.accumulatedTick;
            const secondPartTick = tokenToSplit.accumulatedTick + tokenToSplit.currentTick - targetTick;

            const firstTokensInfo = ticksToNoteTokens(firstPartTick);
            const secondTokensInfo = ticksToNoteTokens(secondPartTick);

            if (!firstTokensInfo || !secondTokensInfo) {
              console.warn(`Cannot split token for tick ${targetTick}. Skipping.`);
              track.splice(splitIndex + 1, 0, newTempoToken);
              return;
            }

            const basePitch = tokenToSplit.raw.match(/^[<>]*[cdefgabnr][#\+\-]?/i)[0];
            let currentAccumulatedTick = tokenToSplit.accumulatedTick;

            const createToken = (base, info, tick) => ({
              type: tokenToSplit.type,
              raw: `${base}${info.notation}`,
              noteLength: parseInt(info.notation),
              hasDot: info.dotted,
              currentTick: info.tick,
              accumulatedTick: tick,
            });

            const finalTokens = [];
            firstTokensInfo.forEach((info, index) => {
              finalTokens.push(createToken(basePitch, info, currentAccumulatedTick));
              currentAccumulatedTick += info.tick;
              if (tokenToSplit.type === "note" && index < firstTokensInfo.length - 1) {
                finalTokens.push({ type: "tie", raw: "&", noteLength: null, hasDot: false, currentTick: 0, accumulatedTick: currentAccumulatedTick });
              }
            });

            finalTokens.push(newTempoToken);

            if (tokenToSplit.type === "note") {
              finalTokens.push({ type: "tie", raw: "&", noteLength: null, hasDot: false, currentTick: 0, accumulatedTick: targetTick });
            }

            secondTokensInfo.forEach((info, index) => {
              finalTokens.push(createToken(basePitch, info, currentAccumulatedTick));
              currentAccumulatedTick += info.tick;
              if (tokenToSplit.type === "note" && index < secondTokensInfo.length - 1) {
                finalTokens.push({ type: "tie", raw: "&", noteLength: null, hasDot: false, currentTick: 0, accumulatedTick: currentAccumulatedTick });
              }
            });

            const tokenAfterSplit = track[splitIndex + 1];
            let deleteCount = 1;

            if (tokenToSplit.type === "note" && tokenAfterSplit && tokenAfterSplit.type === "tie") {
              finalTokens.push({ type: "tie", raw: "&", noteLength: null, hasDot: false, currentTick: 0, accumulatedTick: currentAccumulatedTick });
              deleteCount = 2;
            }

            track.splice(splitIndex, deleteCount, ...finalTokens);
          } else {
            const insertBeforeIndex = track.findIndex((token) => token.accumulatedTick > targetTick);
            if (insertBeforeIndex !== -1) {
              track.splice(insertBeforeIndex, 0, newTempoToken);
            } else {
              track.push(newTempoToken);
            }
          }
        });
    });

    return newTracks;
  }

  /**
   * 주어진 tick 값에 가장 적합한 음표/쉼표 토큰들의 조합을 찾습니다.
   * 동적 계획법을 사용하여 최적의 조합을 구성합니다.
   * @param {number} targetTick - 변환할 총 tick 수.
   * @returns {Array<Object>|null} tick 값에 해당하는 음표/쉼표 토큰 정보 배열, 또는 실패 시 null.
   *
   * @description
   * 음표 선택 우선순위:
   * 1. 정규 음표 (1, 2, 4, 8, 16, 32, 64, 3, 6, 12, 24, 48 및 점음표)
   *    - 1순위 정규음표: 1, 2, 4, 8, 16, 32, 64
   *    - 2순위 정규음표: 3, 6, 12, 24, 48
   * 2. (정규성/등급 같으면) 음표 표기법의 문자열 길이가 짧은 것 (e.g., "4" > "16.")
   * 3. (모두 같으면) 음표 숫자가 큰 것 (e.g., 6tick -> 64분 음표)
   *
   * DP 최적화 기준:
   * 1. 음표 조합의 개수가 적을수록 좋음
   * 2. (개수가 같으면) MML 문자열 길이가 짧을수록 좋음
   */
  function ticksToNoteTokens(targetTick) {
    const WHOLE_TICK = 384;
    const TIER1_REGULAR_LENGTHS = new Set([1, 2, 4, 8, 16, 32, 64]);
    const TIER2_REGULAR_LENGTHS = new Set([3, 6, 12, 24, 48]);

    /**
     * 각 tick 값에 대한 최적의 단일 음표 후보를 결정하여 map에 업데이트합니다.
     * @param {object} note - 비교할 음표 정보 객체
     * @param {Map<number, object>} noteMap - 최적의 음표들을 저장하는 맵
     */
    const updateNoteMapIfNeeded = (note, noteMap) => {
      const existing = noteMap.get(note.tick);
      if (
        !existing || // 1. 기존 값 없음
        note.priority > existing.priority || // 2. 새 음표의 정규 등급이 더 높음
        (note.priority === existing.priority && note.notation.length < existing.notation.length) || // 3. 등급 같고, 새 음표의 문자열 길이가 더 짧음
        (note.priority === existing.priority && note.notation.length === existing.notation.length && note.len > existing.len) // 4. 등급/길이 같고, 음표 숫자가 더 큼
      ) {
        noteMap.set(note.tick, note);
      }
    };

    /**
     * 두 음표 조합 중 어느 것이 더 나은지 5단계 우선순위에 따라 비교합니다.
     * @param {Array<object>} newSolution - 새로운 음표 조합
     * @param {Array<object>} currentBest - 현재까지의 최적 음표 조합
     * @returns {boolean} 새로운 조합이 더 나으면 true를 반환합니다.
     */
    const isNewSolutionBetter = (newSolution, currentBest) => {
      if (!currentBest) return true;

      // 각 조합의 평가 지표를 계산하는 헬퍼 함수
      const getMetrics = (solution) => ({
        noteCount: solution.length,
        regularCount: solution.filter((n) => n.isRegular).length,
        prioritySum: solution.reduce((sum, n) => sum + n.priority, 0),
        notationLength: solution.reduce((sum, n) => sum + n.notation.length, 0),
        range: solution.length < 2 ? 0 : Math.max(...solution.map((n) => n.len)) - Math.min(...solution.map((n) => n.len)),
      });

      const newMetrics = getMetrics(newSolution);
      const bestMetrics = getMetrics(currentBest);

      if (newMetrics.noteCount !== bestMetrics.noteCount) return newMetrics.noteCount < bestMetrics.noteCount;
      if (newMetrics.regularCount !== bestMetrics.regularCount) return newMetrics.regularCount > bestMetrics.regularCount;
      if (newMetrics.prioritySum !== bestMetrics.prioritySum) return newMetrics.prioritySum > bestMetrics.prioritySum;
      if (newMetrics.notationLength !== bestMetrics.notationLength) return newMetrics.notationLength < bestMetrics.notationLength;
      if (newMetrics.range !== bestMetrics.range) return newMetrics.range < bestMetrics.range;

      return false; // 두 조합이 모든 면에서 동일
    };

    // 1. 최적의 단일 음표 후보군 생성
    const noteMap = new Map();
    for (let len = 1; len <= 64; len++) {
      const baseTick = Math.floor(WHOLE_TICK / len);
      let priority = 0;
      if (TIER1_REGULAR_LENGTHS.has(len)) priority = 2;
      else if (TIER2_REGULAR_LENGTHS.has(len)) priority = 1;

      if (baseTick > 0) {
        updateNoteMapIfNeeded({ tick: baseTick, notation: `${len}`, dotted: false, isRegular: priority > 0, priority, len }, noteMap);
      }
      const dottedTick = Math.floor(baseTick * 1.5);
      if (dottedTick > baseTick) {
        updateNoteMapIfNeeded({ tick: dottedTick, notation: `${len}.`, dotted: true, isRegular: priority > 0, priority, len }, noteMap);
      }
    }
    const notePossibilities = Array.from(noteMap.values()).sort((a, b) => b.tick - a.tick);

    // 2. 동적 계획법(DP)으로 최적의 조합 찾기
    const dp = new Array(targetTick + 1).fill(null);
    dp[0] = [];

    for (let i = 1; i <= targetTick; i++) {
      for (const note of notePossibilities) {
        if (i >= note.tick && dp[i - note.tick] !== null) {
          const newSolution = [...dp[i - note.tick], note];
          if (isNewSolutionBetter(newSolution, dp[i])) {
            dp[i] = newSolution;
          }
        }
      }
    }

    if (dp[targetTick] === null) {
      // console.warn(`Tick-to-note 변환 실패: ${targetTick} tick에 대한 조합을 찾을 수 없습니다.`);
      return null;
    }

    return dp[targetTick];
  }

  /**
   * 트랙들의 템포 구간별로 노트/쉼표 개수를 분석합니다.
   * @param {Array<Array<Object>>} tracks - 템포 토큰이 삽입된 트랙 배열
   * @param {Array<Object>} tempoPoints - {tick, tempo} 객체 배열
   * @returns {Array<Object>} 구간별 분석 정보 배열
   */
  function analyzeTempoSegments(tracks, tempoPoints) {
    const segmentInfo = [];

    // 전체 트랙 중 가장 긴 트랙의 마지막 tick을 계산
    const maxTick = tracks.reduce((max, track) => {
      if (track.length === 0) return max;
      const lastToken = track[track.length - 1];
      return Math.max(max, lastToken.accumulatedTick + lastToken.currentTick);
    }, 0);

    // [수정 제안 1] 모든 트랙에서 마지막 음표/쉼표가 끝나는 시간을 계산합니다.
    const lastNoteEndTick = tracks.reduce((max, track) => {
      const lastNoteToken = [...track].reverse().find((t) => t.type === "note" || t.type === "rest");
      if (!lastNoteToken) return max;
      return Math.max(max, lastNoteToken.accumulatedTick + lastNoteToken.currentTick);
    }, 0);

    // 1. 각 템포 구간의 시작/끝 tick 정의
    for (let i = 0; i < tempoPoints.length; i++) {
      const startTick = tempoPoints[i].tick;
      // 마지막 구간의 끝은 전체 트랙의 마지막 tick으로 설정
      const endTick = i < tempoPoints.length - 1 ? tempoPoints[i + 1].tick : maxTick;

      // [수정 제안 2] 마지막 템포 포인트이고, 실제 연주되는 음표가 없는 구간이면 건너뜁니다.
      if (i === tempoPoints.length - 1 && startTick >= lastNoteEndTick) {
        appendToLog(`[분석] 마지막 템포 구간(tick: ${startTick})은 연주되는 음표가 없어 분석에서 제외합니다.`);
        continue;
      }

      const segment = {
        startTick: startTick,
        endTick: endTick,
        tempo: tempoPoints[i].tempo,
        trackNoteCounts: [],
      };

      // 2. 각 트랙을 순회하며 해당 구간의 음표 수 계산
      tracks.forEach((track, trackIndex) => {
        const count = track.filter(
          (token) => (token.type === "note" || token.type === "rest") && token.accumulatedTick >= startTick && token.accumulatedTick < endTick
        ).length;
        segment.trackNoteCounts.push({ trackIndex, count });
      });

      segmentInfo.push(segment);
    }

    return segmentInfo;
  }

  /**
   * 모든 트랙의 시작과 끝 템포를 정규화합니다.
   * 1. 트랙 시작 부분에 템포(t) 명령어가 없으면 t120을 추가합니다.
   * 2. 모든 트랙의 마지막 음표/쉼표 뒤에 공통적으로 나타나는 불필요한 템포 토큰을 제거합니다.
   * @param {Array<Array<Object>>} tracks - 템포 토큰이 삽입된 트랙 배열 (이 배열은 직접 수정됩니다).
   */
  function normalizeTempoTokens(tracks) {
    // 1. 시작 템포 보장
    tracks.forEach((track, index) => {
      // 트랙이 비어있거나, 첫 토큰의 시작 tick이 0이 아니거나, 이미 템포 토큰인 경우는 제외
      if (track.length === 0 || track[0].accumulatedTick !== 0 || track[0].raw.toLowerCase().startsWith("t")) {
        return;
      }

      // 첫 토큰이 템포가 아니면, 맨 앞에 t120 템포 토큰을 추가
      appendToLog(`[Track ${index + 1}] 시작 템포가 누락되어 t120을 추가합니다.`);
      console.log(`[Track ${index + 1}] 시작 템포가 누락되어 t120을 추가합니다.`);
      track.unshift({
        type: "command",
        raw: "t120",
        noteLength: null,
        hasDot: false,
        currentTick: 0,
        accumulatedTick: 0,
        currentOctave: track[0].currentOctave, // 옥타브 일관성 유지
      });
    });

    // 2. 끝 템포 최적화
    if (tracks.length === 0) return;

    // 각 트랙의 마지막 음표/쉼표/n음표 이후의 첫 템포 토큰을 찾습니다.
    const lastTempoTokens = tracks.map((track) => {
      let lastNoteIndex = -1;
      for (let i = track.length - 1; i >= 0; i--) {
        const tokenType = track[i].type;
        if (tokenType === "note" || tokenType === "rest" || tokenType === "n_note") {
          lastNoteIndex = i;
          break;
        }
      }
      return track.slice(lastNoteIndex + 1).find((t) => t.raw.toLowerCase().startsWith("t")) || null;
    });

    // 모든 트랙이 마지막 음표 뒤에 템포 토큰을 가지고 있는지, 그리고 그 템포 값이 모두 동일한지 확인합니다.
    const firstTempo = lastTempoTokens[0];
    if (firstTempo && lastTempoTokens.every((t) => t && t.raw.toLowerCase() === firstTempo.raw.toLowerCase())) {
      appendToLog(`모든 트랙의 끝에서 공통된 템포 토큰 '${firstTempo.raw}'을(를) 발견하여 삭제합니다.`);
      console.log(`모든 트랙의 끝에서 공통된 템포 토큰 '${firstTempo.raw}'을(를) 발견하여 삭제합니다.`);

      // 모든 트랙에서 해당 템포 토큰을 제거합니다.
      tracks.forEach((track, index) => {
        const tokenToRemove = lastTempoTokens[index];
        const tokenIndex = track.lastIndexOf(tokenToRemove);
        if (tokenIndex > -1) {
          track.splice(tokenIndex, 1);
        }
      });
    }
  }

  /**
   * 각 템포 구간의 음표/쉼표 개수를 최대치에 맞게 통일합니다.
   * @param {Array<Array<Object>>} tracks - 템포 토큰이 삽입된 트랙 배열
   * @param {Array<Object>} tempoSegmentsInfo - 구간별 분석 정보 배열
   * @returns {Array<Array<Object>>} 음표 개수가 통일된 새로운 트랙 배열
   */
  function equalizeNoteCounts1(tracks, tempoSegmentsInfo) {
    // 원본 수정을 피하기 위해 깊은 복사
    const newTracks = JSON.parse(JSON.stringify(tracks));

    // 각 템포 구간에 대해 작업 수행
    tempoSegmentsInfo.forEach((segment, segmentIndex) => {
      // 마지막 템포 구간에 대해서는 작업 수행하지 않음
      if (segmentIndex === tempoSegmentsInfo.length - 1) {
        console.log(`\n[Segment ${segmentIndex + 1}] Tick: ${segment.startTick}-${segment.endTick}, Skipping last segment processing.`);
        return;
      }

      const { startTick, endTick, trackNoteCounts } = segment;
      const targetCount = Math.max(...trackNoteCounts.map((t) => t.count));

      console.log(`\n[Segment ${segmentIndex + 1}] Tick: ${startTick}-${endTick}, Target Note Count: ${targetCount}`);

      trackNoteCounts.forEach(({ trackIndex, count }) => {
        const diff = targetCount - count;

        if (diff <= 0) return;

        console.log(`  [Track ${trackIndex + 1}] ${count} -> ${targetCount} (${diff} notes to add)`);

        let notesToAdd = diff;
        let currentCount = count;
        while (notesToAdd > 0) {
          const track = newTracks[trackIndex];
          const allSplittableInSegment = track.filter(
            (t) =>
              (t.type === "note" || t.type === "rest") && t.accumulatedTick >= startTick && t.accumulatedTick < endTick && t.noteLength < 64 && t.noteLength > 0
          );

          if (allSplittableInSegment.length === 0) {
            console.warn(`    - No more splittable tokens in this segment for Track ${trackIndex + 1}.`);
            break;
          }

          // --- 새로운 전략: 절대적 쉼표 우선 ---
          // 1. 분할 대상을 쉼표 또는 음표로 한정합니다.
          const splittableRests = allSplittableInSegment.filter((t) => t.type === "rest");
          let tokensToProcess;

          if (splittableRests.length > 0) {
            tokensToProcess = splittableRests;
            console.log("    - Prioritizing rests for splitting.");
          } else {
            tokensToProcess = allSplittableInSegment.filter((t) => t.type === "note");
            console.log("    - No splittable rests found. Processing notes.");
          }

          if (tokensToProcess.length === 0) break; // 분할할 대상이 없으면 종료

          // --- 새로운 전략: 연속된 동일 길이 그룹 분할 ---

          // 1. 연속된 음표/쉼표 덩어리(run)를 찾고, 각 덩어리 내에서 길이별로 그룹화
          const consecutiveRuns = [];
          if (tokensToProcess.length > 0) {
            let currentRun = [tokensToProcess[0]];
            for (let i = 1; i < tokensToProcess.length; i++) {
              const prevToken = tokensToProcess[i - 1];
              const currentToken = tokensToProcess[i];
              const prevTokenIndexInTrack = track.findIndex((t) => t === prevToken);

              // 두 토큰 사이에 L명령어나 다른 음표/쉼표가 있는지 확인 (v, o, t 등은 허용)
              let isContinuous = true;
              for (let j = prevTokenIndexInTrack + 1; j < track.length; j++) {
                const interveningToken = track[j];
                if (interveningToken === currentToken) break; // 다음 토큰에 도달하면 연속
                if (
                  interveningToken.type === "note" ||
                  interveningToken.type === "rest" ||
                  interveningToken.raw.toLowerCase().startsWith("l") ||
                  interveningToken.type === "n_note"
                ) {
                  isContinuous = false; // L이나 다른 음표/쉼표가 있으면 연속이 아님
                  break;
                }
              }

              if (isContinuous) {
                currentRun.push(currentToken);
              } else {
                consecutiveRuns.push(currentRun);
                currentRun = [currentToken];
              }
            }
            consecutiveRuns.push(currentRun);
          }

          const groupsByLengthInRuns = consecutiveRuns.flatMap((run) =>
            Object.values(
              run.reduce((acc, token) => {
                const key = `${token.noteLength}${token.hasDot ? "." : ""}`;
                if (!acc[key]) acc[key] = [];
                acc[key].push(token);
                return acc;
              }, {})
            )
          );

          let bestGroupToSplit = null;
          let bestGroupIsRest = false;
          // 2. 최적 분할 그룹 탐색
          for (const group of groupsByLengthInRuns) {
            const notesInGroup = group.length;
            const notesAfterSplit = currentCount + notesInGroup;

            // 1순위: 분할 시 목표 개수와 정확히 일치하는 그룹
            if (notesAfterSplit === targetCount) {
              // 쉼표 그룹을 항상 우선
              if (!bestGroupToSplit || (group[0].type === "rest" && !bestGroupIsRest)) {
                bestGroupToSplit = group;
                bestGroupIsRest = group[0].type === "rest";
              }
              // 쉼표 그룹을 찾으면 더 이상 음표 그룹은 보지 않음
              if (bestGroupIsRest) break;
            }

            // 2순위: 목표를 초과하지 않으면서 가장 많은 음표를 추가하는 그룹
            if (notesAfterSplit < targetCount) {
              // 쉼표 그룹이거나, 아직 최적 그룹이 없거나, 현재 그룹이 더 클 경우
              if (group[0].type === "rest" && !bestGroupIsRest) {
                bestGroupToSplit = group;
                bestGroupIsRest = true;
              } else if (!bestGroupIsRest && (!bestGroupToSplit || notesInGroup > bestGroupToSplit.length)) {
                bestGroupToSplit = group;
              }
            }
          }

          // 3. 그룹 분할 실행 또는 개별 분할로 전환
          if (bestGroupToSplit) {
            const groupLength = bestGroupToSplit.length;
            console.log(`    - Splitting group of length ${bestGroupToSplit[0].raw} (count: ${groupLength})`);
            for (let j = groupLength - 1; j >= 0; j--) {
              const tokenToSplitRef = bestGroupToSplit[j];
              const tokenToSplitIndex = track.findIndex((t) => t === tokenToSplitRef);
              if (tokenToSplitIndex === -1) continue;

              const newTokens = splitSingleToken(track[tokenToSplitIndex]);
              track.splice(tokenToSplitIndex, 1, ...newTokens);
            }
            notesToAdd -= groupLength;
            currentCount += groupLength;
            continue; // 그룹 분할 후 다시 최적 그룹 탐색
          }

          // 4. 개별 분할 (가장 우선순위 높은 음표 하나)
          tokensToProcess.sort((a, b) => {
            if (a.type === "rest" && b.type !== "rest") return -1;
            if (a.type !== "rest" && b.type === "rest") return 1;
            return 0;
          });

          const tokenToSplitRef = tokensToProcess[0];
          const tokenToSplitIndex = track.findIndex((t) => t === tokenToSplitRef);

          if (tokenToSplitIndex === -1) {
            console.warn("Could not find token to split in track. Skipping.", tokenToSplitRef);
            break;
          }

          const newTokens = splitSingleToken(track[tokenToSplitIndex]);
          console.log(`    - Splitting individual note: ${track[tokenToSplitIndex].raw} -> ${newTokens.map((t) => t.raw).join("")}`);

          track.splice(tokenToSplitIndex, 1, ...newTokens);

          notesToAdd--;
          currentCount++;
        }
      });
    });

    return newTracks;
  }

  /**
   * 각 템포 구간의 음표/쉼표 개수를 최대치에 맞게 통일합니다. (전략 3)
   * equalizeNoteCounts 기반, 분할 전략만 수정
   * @param {Array<Array<Object>>} tracks - 템포 토큰이 삽입된 트랙 배열
   * @param {Array<Object>} tempoSegmentsInfo - 구간별 분석 정보 배열
   * @returns {Array<Array<Object>>} 음표 개수가 통일된 새로운 트랙 배열
   */
  function equalizeNoteCounts2(tracks, tempoSegmentsInfo) {
    const newTracks = JSON.parse(JSON.stringify(tracks));

    tempoSegmentsInfo.forEach((segment, segmentIndex) => {
      if (segmentIndex === tempoSegmentsInfo.length - 1) {
        console.log(`\n[Segment ${segmentIndex + 1}] Tick: ${segment.startTick}-${segment.endTick}, Skipping last segment processing.`);
        return;
      }

      const { startTick, endTick, trackNoteCounts } = segment;
      const targetCount = Math.max(...trackNoteCounts.map((t) => t.count));

      console.log(`\n[Segment ${segmentIndex + 1}] Tick: ${startTick}-${endTick}, Target Note Count: ${targetCount}`);

      trackNoteCounts.forEach(({ trackIndex, count }) => {
        let currentNoteCount = count;
        if (currentNoteCount >= targetCount) return;

        console.log(`  [Track ${trackIndex + 1}] ${currentNoteCount} -> ${targetCount} (${targetCount - currentNoteCount} notes to add)`);

        const track = newTracks[trackIndex];
        let iterationGuard = 0;

        while (currentNoteCount < targetCount && iterationGuard < 1000) {
          iterationGuard++;
          console.log(`\n    --- Iteration ${iterationGuard} (current notes: ${currentNoteCount}) ---`);

          // 1. 분할 대상 찾기 (쉼표 -> 반음 없는 음표 -> 나머지 음표 순, 각 그룹 내에서는 가장 긴 음표 우선)
          const splittableTokens = track.filter(
            (t) => (t.type === "rest" || t.type === "note") && t.accumulatedTick >= startTick && t.accumulatedTick < endTick && t.noteLength < 64
          );

          if (splittableTokens.length === 0) {
            console.warn(`    - No more splittable tokens in this segment for Track ${trackIndex + 1}.`);
            break;
          }

          // 우선순위에 따라 토큰 분류
          const rests = splittableTokens.filter((t) => t.type === "rest");
          const naturalNotes = splittableTokens.filter((t) => t.type === "note" && !/[#\+\-]/.test(t.raw));
          const accidentalNotes = splittableTokens.filter((t) => t.type === "note" && /[#\+\-]/.test(t.raw));

          // 각 그룹을 음표 길이(noteLength) 오름차순으로 정렬 (가장 긴 음표가 맨 앞으로)
          const sortByLength = (a, b) => a.noteLength - b.noteLength;
          rests.sort(sortByLength);
          naturalNotes.sort(sortByLength);
          accidentalNotes.sort(sortByLength);

          // 우선순위에 따라 분할할 토큰 하나를 선택
          let tokenToSplitRef = null;
          if (rests.length > 0) {
            tokenToSplitRef = rests[0];
          } else if (naturalNotes.length > 0) {
            tokenToSplitRef = naturalNotes[0];
          } else if (accidentalNotes.length > 0) {
            tokenToSplitRef = accidentalNotes[0];
          }

          if (!tokenToSplitRef) {
            console.warn(`    - Could not determine a token to split for Track ${trackIndex + 1}.`);
            break;
          }

          const targetTokenIndex = track.findIndex((t) => t === tokenToSplitRef);
          if (targetTokenIndex === -1) {
            console.warn(`    - No more splittable tokens in this segment for Track ${trackIndex + 1}.`);
            break;
          }

          const tokenToSplit = track[targetTokenIndex];
          console.log(`    [Step 1] Found token to split at index ${targetTokenIndex}: ${tokenToSplit.raw}`);

          // 3. 지수적 분할 시작
          let splitTokens = [tokenToSplit];
          track.splice(targetTokenIndex, 1); // 원본에서 대상 토큰 제거

          console.log("    [Step 2] Starting exponential splitting...");
          while (true) {
            console.log(`      - Current group: [${splitTokens.map((t) => t.raw).join(" ")}] (count: ${splitTokens.filter((t) => t.type !== "tie").length})`);

            // 다음 분할 시 추가될 음표의 개수는 현재 그룹의 음표/쉼표 개수와 같습니다.
            const notesToAddOnNextSplit = splitTokens.filter((t) => t.type !== "tie").length;

            // 4. 분할 중단 조건 확인
            if (currentNoteCount + notesToAddOnNextSplit > targetCount) {
              console.log(
                `      - Next split would exceed target (${currentNoteCount} + ${notesToAddOnNextSplit} = ${
                  currentNoteCount + notesToAddOnNextSplit
                } > ${targetCount}). Stopping split.`
              );
              break;
            }
            if (!splitTokens[0] || splitTokens.find((t) => t.type !== "tie").noteLength * 2 > 64) {
              console.log(`    - Note length limit (64) reached. Stopping split.`);
              break;
            }

            // 5. 분할 실행
            const newSplitTokens = [];
            for (const token of splitTokens) {
              if (token.type === "tie") {
                newSplitTokens.push(token);
                continue;
              }
              const splitResult = splitSingleToken(token);
              newSplitTokens.push(...splitResult);
            }
            splitTokens = newSplitTokens;
            currentNoteCount += notesToAddOnNextSplit;
          }

          // 6. 분할된 토큰들을 트랙에 다시 삽입 (L 명령어 처리 없이)
          console.log(`    [Step 3] Inserting split tokens: ${splitTokens.map((t) => t.raw).join(" ")}`);
          track.splice(targetTokenIndex, 0, ...splitTokens);

          if (iterationGuard >= 999) {
            console.error("    - Max iteration guard reached. Breaking loop to prevent infinite execution.");
            break;
          }
        }
      });
    });

    return newTracks;
  }

  /**
   * 단일 토큰을 두 개의 더 짧은 토큰으로 분할합니다.
   * @param {Object} tokenToSplit - 분할할 토큰 객체
   * @returns {Array<Object>} 분할된 새 토큰들의 배열
   */
  function splitSingleToken(tokenToSplit) {
    const originalTick = tokenToSplit.currentTick;
    const splitTick = originalTick / 2;

    const newLength = tokenToSplit.noteLength * 2;
    const dotString = tokenToSplit.hasDot ? "." : "";
    const basePitch = tokenToSplit.raw.match(/^[<>]*[cdefgabnr][#\+\-]?/i)[0];

    const newRaw = `${basePitch}${newLength}${dotString}`;

    // 분할된 새 토큰 생성
    const token1 = {
      ...tokenToSplit,
      raw: newRaw,
      noteLength: newLength,
      currentTick: splitTick,
      // accumulatedTick은 기존 토큰과 동일
    };

    const token2 = {
      ...tokenToSplit,
      raw: newRaw,
      noteLength: newLength,
      currentTick: splitTick,
      accumulatedTick: tokenToSplit.accumulatedTick + splitTick,
    };

    let newTokens = [token1];
    if (tokenToSplit.type === "note") {
      newTokens.push({
        type: "tie",
        raw: "&",
        noteLength: null,
        hasDot: false,
        currentTick: 0,
        accumulatedTick: token2.accumulatedTick,
        currentOctave: tokenToSplit.currentOctave,
      });
    }
    newTokens.push(token2);

    return newTokens;
  }

  /**
   * 후처리된 트랙 토큰 배열을 최종 MML 문자열로 변환합니다.
   * @param {Array<Array<Object>>} processedTracks - 모든 처리가 완료된 토큰들의 트랙 배열
   * @returns {{finalMML: string, trackLengths: number[]}} 완성된 MML 코드와 각 트랙의 길이를 담은 객체
   * @param {boolean} createFinalMML - 최종 MML 문자열을 생성할지 여부
   * @returns {{finalMML: string, trackLengths: number[], trackStrings: string[]}}
   */
  function serializeTracks(processedTracks, createFinalMML = true) {
    const trackStrings = processedTracks.map((track) => {
      return track.map((token) => token.raw).join("");
    });

    const trackLengths = trackStrings.map((track) => track.length);
    const finalMML = createFinalMML ? `MML@${trackStrings.join(",")};` : "";

    return { finalMML, trackLengths, trackStrings };
  }

  /**
   * L 명령어 최적화를 해제하고 모든 음표/쉼표에 길이를 명시적으로 표기합니다.
   * @param {Array<Array<Object>>} tracks - 처리할 트랙 배열
   * @returns {Array<Array<Object>>} L명령어가 해제된 새로운 트랙 배열
   */
  function expandLCommands(tracks) {
    const newTracks = [];

    for (const track of tracks) {
      const newTrack = [];
      let defaultLength = 4;
      let defaultHasDot = false;

      for (const token of track) {
        const lowerRaw = token.raw.toLowerCase();

        if (lowerRaw.startsWith("l")) {
          // 1. L 토큰을 만나면 기본 길이를 갱신하고 토큰은 추가하지 않음 (삭제)
          const match = lowerRaw.match(/l(\d+)(\.?)?/);
          if (match) {
            defaultLength = parseInt(match[1], 10);
            defaultHasDot = !!match[2];
          }
          continue; // L 토큰은 결과에 포함시키지 않음
        }

        const newToken = { ...token };

        if (token.type === "note" || token.type === "rest") {
          // 2. 음표/쉼표 토큰의 raw 값에 길이가 명시되지 않았는지 확인
          const hasExplicitLength = /\d/.test(lowerRaw.replace(/^[cdefgabnr][#+-]?/, ""));

          if (!hasExplicitLength) {
            // 길이가 명시되지 않았다면 기본 길이를 사용하여 raw 값을 재구성
            const pitchPart = lowerRaw.match(/^[cdefgabnr][#+-]?/)[0];
            const hasExplicitDot = lowerRaw.includes(".");

            let newRaw = `${pitchPart}${defaultLength}`;
            if (hasExplicitDot || defaultHasDot) {
              // 토큰 자체에 점이 있거나, L 명령어에 점이 있었다면 점 추가
              // 단, 중복 추가 방지
              if (!newRaw.endsWith(".")) {
                newRaw += ".";
              }
            }
            newToken.raw = newRaw;
          }
        }

        newTrack.push(newToken);
      }
      newTracks.push(newTrack);
    }

    return newTracks;
  }

  /**
   * 전체 최적화 파이프라인을 실행합니다.
   * L 명령어 최적화와 n-note 최적화를 순차적으로 적용합니다.
   * @param {Array<Array<Object>>} tracks - 최적화할 트랙 배열
   * @returns {Array<Array<Object>>} 모든 최적화가 적용된 트랙 배열
   */
  function runOptimizationPipeline(tracks) {
    appendToLog("최종 MML 코드 임시 최적화 시작...");
    console.log("--- 전체 최적화 파이프라인 시작 ---");
    const optimizedLTracks = optimizeLCommands(tracks);
    const optimizedNNoteTracks = optimizeNNotes(optimizedLTracks);
    const optimizedEnharmonics = optimizeEnharmonicNotes(optimizedNNoteTracks);
    appendToLog("임시 최적화 완료.");
    console.log("--- 전체 최적화 파이프라인 완료 ---");

    return optimizedEnharmonics;
  }

  /**
   * 여러 트랙에 대해 최적화 파이프라인을 적용합니다.
   * @param {Array<Array<Object>>} tracks - 최적화할 트랙 배열
   * @returns {Array<Array<Object>>} 최적화된 트랙 배열
   */
  function optimizeLCommands(tracks) {
    console.log("--- L 명령어 최적화 시작 ---");
    const newTracks = tracks.map((track, trackIndex) => {
      // 1단계: 그룹을 찾아 L 명령어 도입
      const phase1 = optimizeLCommandPhase1(track);
      // 2단계: 현재 L값과 일치하는 개별 음표의 길이 제거
      const phase2 = optimizeLCommandPhase2(phase1);
      // 3단계: 불필요한 L 명령어 제거
      const phase3 = optimizeLCommandPhase3(phase2, trackIndex);
      return phase3;
    });
    console.log("--- L 명령어 최적화 완료 ---");
    return newTracks;
  }
  /**
   * L 명령어를 사용하여 트랙을 최적화합니다.
   * @param {Array<Object>} track - 최적화할 트랙의 토큰 배열
   * @returns {Array<Object>} 최적화된 새로운 토큰 배열
   */
  function optimizeLCommandPhase1(track) {
    // 0. 최적화를 시작하기 전에, 각 토큰 위치에서 유효한 L 값을 미리 계산합니다.
    const lValueMap = new Map();
    let activeLValue = "4";
    for (let i = 0; i < track.length; i++) {
      lValueMap.set(i, activeLValue);
      const token = track[i];
      if (token.raw.toLowerCase().startsWith("l")) {
        const match = token.raw.toLowerCase().match(/l(\d+\.?)/);
        if (match) {
          activeLValue = match[1];
        }
      }
    }

    let newTrack = [];
    let i = 0;

    while (i < track.length) {
      const currentToken = track[i];

      // 현재 토큰이 음표나 쉼표가 아니면 그대로 추가하고 다음으로 넘어감
      if (currentToken.type !== "note" && currentToken.type !== "rest") {
        newTrack.push(currentToken);
        i++;
        continue;
      }

      // 1. 현재 위치에서 시작하는, 같은 길이의 연속된 음표/쉼표 그룹 찾기
      const group = {
        tokens: [], // 그룹에 속한 모든 토큰 (명령어 포함)
        notes: [], // 그룹 내 음표/쉼표 토큰만
        noteLengthStr: `${currentToken.noteLength}${currentToken.hasDot ? "." : ""}`,
        startIndex: i,
        endIndex: i,
      };

      let j = i;
      while (j < track.length) {
        const nextToken = track[j];
        if (nextToken.type === "note" || nextToken.type === "rest") {
          const currentLengthStr = `${nextToken.noteLength}${nextToken.hasDot ? "." : ""}`;
          if (currentLengthStr === group.noteLengthStr) {
            group.tokens.push(nextToken);
            group.notes.push(nextToken);
            group.endIndex = j + 1;
          } else {
            break; // 다른 길이의 음표를 만나면 그룹 종료
          }
        } else if (!nextToken.raw.toLowerCase().startsWith("l")) {
          // L이 아닌 다른 명령어/토큰은 그룹에 포함
          group.tokens.push(nextToken);
          group.endIndex = j + 1;
        } else {
          break; // L 명령어를 만나면 그룹 종료
        }
        j++;
      }

      // 2. 그룹에 대한 최적화 이득 계산
      if (group.notes.length > 1) {
        const lValueBeforeGroup = lValueMap.get(group.startIndex);
        const lCommandForGroup = `l${group.noteLengthStr}`;

        const originalLength = group.notes.reduce((sum, n) => sum + n.raw.length, 0);
        const optimizedNoteLength = group.notes.reduce((sum, n) => sum + n.raw.replace(/\d+\.?/, "").length, 0);

        let cost = 0;
        // 그룹 앞에 L명령어를 추가하는 비용
        if (lCommandForGroup !== `l${lValueBeforeGroup}`) {
          cost += lCommandForGroup.length;
        }

        // 그룹 뒤에 원래 L값으로 복원하는 비용
        const nextToken = track[group.endIndex];
        const needsRestoration = !(nextToken && nextToken.raw.toLowerCase().startsWith("l")) && group.noteLengthStr !== lValueBeforeGroup;
        if (needsRestoration) {
          cost += `l${lValueBeforeGroup}`.length;
        }

        const optimizedTotalLength = optimizedNoteLength + cost;

        const gain = originalLength - optimizedTotalLength;

        if (gain > 0) {
          // 3. 이득이 있으면 최적화 적용
          if (lCommandForGroup !== `l${lValueBeforeGroup}`) {
            newTrack.push({ type: "command", raw: lCommandForGroup });
          }
          group.tokens.forEach((runToken) => {
            if (runToken.type === "note" || runToken.type === "rest") {
              const newRaw = runToken.raw.replace(/\d+\.?/, "");
              newTrack.push({ ...runToken, raw: newRaw });
            } else {
              newTrack.push(runToken);
            }
          });
          if (needsRestoration) {
            newTrack.push({ type: "command", raw: `l${lValueBeforeGroup}` });
          }
          i = group.endIndex; // 인덱스 점프
          continue;
        }
      }

      // 최적화 대상이 아니면 현재 토큰만 추가하고 다음으로 넘어감
      newTrack.push(currentToken);
      i++;
    }

    return newTrack;
  }

  /**
   * L 명령어 최적화 2단계: 현재 L값과 일치하는 개별 음표의 길이를 제거합니다.
   * @param {Array<Object>} track - 1단계 최적화가 끝난 트랙의 토큰 배열
   * @returns {Array<Object>} 2단계 최적화가 적용된 새로운 토큰 배열
   */
  function optimizeLCommandPhase2(track) {
    const newTrack = [];
    let currentLValue = "4"; // MML의 기본 L값

    for (const token of track) {
      const lowerRaw = token.raw.toLowerCase();

      if (lowerRaw.startsWith("l")) {
        // L 명령어를 만나면 현재 L값을 갱신
        const match = lowerRaw.match(/l(\d+\.?)/);
        if (match) {
          currentLValue = match[1];
        }
        newTrack.push(token);
        continue;
      }

      if (token.type === "note" || token.type === "rest") {
        const noteLengthStr = `${token.noteLength}${token.hasDot ? "." : ""}`;

        // 음표의 길이가 현재 L값과 같고, raw 값에 길이가 명시되어 있다면 제거
        if (noteLengthStr === currentLValue && /\d/.test(lowerRaw)) {
          const newRaw = token.raw.replace(/\d+\.?/, "");
          // raw 값이 비어있지 않은 경우에만 (예: 'c16' -> 'c')
          if (newRaw) {
            const newToken = { ...token, raw: newRaw };
            newTrack.push(newToken);
            continue;
          }
        }
      }

      // 최적화 대상이 아니면 원본 토큰을 그대로 추가
      newTrack.push(token);
    }

    return newTrack;
  }

  /**
   * L 명령어 최적화 3단계: 불필요한 L 명령어를 제거하여 전체 길이를 줄입니다.
   * @param {Array<Object>} track - 2단계 최적화가 끝난 트랙의 토큰 배열
   * @returns {Array<Object>} 3단계 최적화가 적용된 새로운 토큰 배열
   */
  function optimizeLCommandPhase3(track, trackIndex) {
    let currentTrack = [...track];
    let changedInPass = true;

    // 변경이 없을 때까지 반복
    while (changedInPass) {
      changedInPass = false;
      let nextTrack = [];
      let lTokenHistory = [{ index: -1, value: "4" }]; // MML 기본값 l4

      // 먼저 트랙의 모든 L 명령어 위치와 값을 수집
      currentTrack.forEach((token, index) => {
        if (token.raw.toLowerCase().startsWith("l")) {
          const match = token.raw.toLowerCase().match(/l(\d+\.?)/);
          if (match) {
            lTokenHistory.push({ index, value: match[1] });
          }
        }
      });

      let lastProcessedIndex = -1;

      for (let i = 1; i < lTokenHistory.length; i++) {
        const lTokenInfo = lTokenHistory[i];
        const prevLTokenInfo = lTokenHistory[i - 1];

        const lIndex = lTokenInfo.index;
        const lTokenToDelete = currentTrack[lIndex];
        const prevLValue = prevLTokenInfo.value;

        // L 명령어의 영향 범위 (현재 L부터 다음 L 직전까지)
        const nextLIndex = i + 1 < lTokenHistory.length ? lTokenHistory[i + 1].index : currentTrack.length;
        const affectedSegment = currentTrack.slice(lIndex + 1, nextLIndex);

        // 원본 세그먼트의 길이 계산 (L 명령어 포함)
        const originalLength = lTokenToDelete.raw.length + affectedSegment.reduce((sum, t) => sum + t.raw.length, 0);

        // L 명령어 삭제를 시뮬레이션했을 때의 길이 계산
        let simulatedLength = 0;
        const simulatedSegmentRaws = [];
        for (const token of affectedSegment) {
          if (token.type === "note" || token.type === "rest") {
            const noteLengthStr = `${token.noteLength}${token.hasDot ? "." : ""}`;
            const pitchPart = token.raw.match(/^[cdefgabnr][#+-]?/i)[0];

            if (noteLengthStr === prevLValue) {
              // 이전 L값과 같아지므로 길이 생략
              simulatedSegmentRaws.push(pitchPart);
            } else {
              // 이전 L값과 다르므로 길이 명시
              simulatedSegmentRaws.push(pitchPart + noteLengthStr);
            }
          } else {
            simulatedSegmentRaws.push(token.raw);
          }
        }
        simulatedLength = simulatedSegmentRaws.join("").length;

        // 이득이 있는지 확인
        if (originalLength > simulatedLength) {
          const originalSegmentRaw = lTokenToDelete.raw + affectedSegment.map((t) => t.raw).join("");
          const simulatedSegmentRaw = simulatedSegmentRaws.join("");
          console.log(`[Track ${trackIndex + 1}, Index: ${lIndex}] Optimizing L-command (gain: ${originalLength - simulatedLength}):`);
          console.log(`  - From: ${originalSegmentRaw}`);
          console.log(`  - To:   ${simulatedSegmentRaw}`);
          changedInPass = true;

          // 이전까지 처리된 부분을 추가
          nextTrack.push(...currentTrack.slice(lastProcessedIndex + 1, lIndex));

          // 변경된 세그먼트 추가
          for (const token of affectedSegment) {
            if (token.type === "note" || token.type === "rest") {
              const noteLengthStr = `${token.noteLength}${token.hasDot ? "." : ""}`;
              const pitchPart = token.raw.match(/^[cdefgabnr][#+-]?/i)[0];
              const newRaw = noteLengthStr === prevLValue ? pitchPart : pitchPart + noteLengthStr;
              nextTrack.push({ ...token, raw: newRaw });
            } else {
              nextTrack.push(token);
            }
          }
          lastProcessedIndex = nextLIndex - 1;
          break; // 한 번에 하나의 L 명령어만 제거하고 루프를 중단합니다.
        }
      }

      // 마지막 처리된 부분 이후의 나머지 토큰들을 추가
      nextTrack.push(...currentTrack.slice(lastProcessedIndex + 1));

      if (changedInPass) {
        // 변경이 있었다면, 다음 반복을 위해 트랙을 업데이트
        // processTokens를 다시 호출하면 L 명령어의 noteLength 정보가 유실될 수 있으므로
        // raw 토큰만으로 새 트랙을 만들어 다시 토큰화/처리합니다.
        const newMmlTrack = nextTrack.map((t) => t.raw).join("");
        currentTrack = processTokens(tokenizeTrack(newMmlTrack));
      }
    }

    return currentTrack;
  }

  /**
   * 음계와 옥타브를 MIDI 번호로 변환합니다.
   * @param {string} pitch - 음계 (e.g., "c", "c+")
   * @param {number} octave - 옥타브
   * @returns {number | null} MIDI 번호 또는 변환 실패 시 null
   */
  function pitchToMidi(pitch, octave) {
    const pitchMap = {
      c: 0,
      "c+": 1,
      d: 2,
      "d+": 3,
      e: 4,
      f: 5,
      "f+": 6,
      g: 7,
      "g+": 8,
      a: 9,
      "a+": 10,
      b: 11,
    };
    const pitchValue = pitchMap[pitch.toLowerCase().replace("#", "+")];
    if (pitchValue === undefined) return null;

    // Mabinogi MML 옥타브 체계에 맞춰 MIDI 번호 계산
    // (예: o4c는 MIDI 60)
    return octave * 12 + pitchValue;
  }

  /**
   * 옥타브 변경 후 복귀하는 패턴의 음표를 n-note로 최적화합니다.
   * 예: `>c<` -> `n61`
   * @param {Array<Array<Object>>} tracks - 최적화할 트랙 배열
   * @returns {Array<Array<Object>>} 최적화된 새로운 트랙 배열
   */
  function optimizeNNotes(tracks) {
    const newTracks = [];

    for (const track of tracks) {
      const newTrack = [];
      let i = 0;
      while (i < track.length) {
        const firstShiftIndex = i;
        let shiftAmount = 0;

        // 1. 옥타브 변경 시퀀스 확인
        while (i < track.length && track[i].type === "octave_shift") {
          shiftAmount += track[i].raw === ">" ? 1 : -1;
          i++;
        }

        // 2. 단일 음표 확인 (길이가 명시되지 않은)
        const noteToken = track[i];
        if (shiftAmount === 0 || !noteToken || noteToken.type !== "note" || /\d/.test(noteToken.raw)) {
          // 패턴의 시작이 아니므로, 스캔 시작 위치의 토큰 하나만 추가하고 다음으로 넘어감
          newTrack.push(track[firstShiftIndex]);
          i = firstShiftIndex + 1;
          continue;
        }
        i++;

        // 3. 옥타브 복귀 시퀀스 확인
        let returnShiftAmount = 0;
        while (i < track.length && track[i].type === "octave_shift") {
          returnShiftAmount += track[i].raw === ">" ? 1 : -1;
          i++;
        }

        if (shiftAmount + returnShiftAmount === 0) {
          const originalTokens = track.slice(firstShiftIndex, i);
          const originalLength = originalTokens.reduce((sum, t) => sum + t.raw.length, 0);

          const pitch = noteToken.raw.match(/^[a-g][#+-]?/i)[0];
          const midi = pitchToMidi(pitch, noteToken.currentOctave);

          if (midi !== null) {
            const nNoteRaw = `n${midi}`;
            const gain = originalLength - nNoteRaw.length;

            if (gain >= 1) {
              console.log(`Optimizing: ${originalTokens.map((t) => t.raw).join("")} -> ${nNoteRaw} (gain: ${gain})`);
              // 이득이 있으면 n_note로 교체
              const nNoteToken = { ...noteToken, type: "n_note", raw: nNoteRaw };
              newTrack.push(nNoteToken);
              continue; // 인덱스는 이미 i로 업데이트됨
            }
          }
        }

        // 패턴을 찾았지만 이득이 없거나 MIDI 변환에 실패하여 최적화하지 않은 경우,
        // 스캔한 토큰들을 그대로 추가합니다.
        newTrack.push(...track.slice(firstShiftIndex, i));
      }
      newTracks.push(newTrack);
    }
    return newTracks;
  }

  /**
   * 이명동음(Enharmonic)을 사용하여 옥타브 변경을 최적화합니다.
   * 예: `>c<` -> `b+`, `<b` -> `c-`
   * @param {Array<Array<Object>>} tracks - 최적화할 트랙 배열
   * @returns {Array<Array<Object>>} 최적화된 새로운 트랙 배열
   */
  function optimizeEnharmonicNotes(tracks) {
    console.log("--- 이명동음 최적화 시작 ---");
    const newTracks = [];

    for (const track of tracks) {
      const newTrack = [];
      let i = 0;
      while (i < track.length) {
        // '>c<' 패턴 찾기
        if (
          i + 2 < track.length &&
          track[i].raw === ">" &&
          track[i + 1].type === "note" &&
          track[i + 1].raw.toLowerCase().startsWith("c") &&
          !track[i + 1].raw.toLowerCase().startsWith("c+") && // c+는 제외
          track[i + 2].raw === "<"
        ) {
          const noteToken = track[i + 1];
          const lengthPart = noteToken.raw.match(/\d*\.?/g).join("");
          const newRaw = `b+${lengthPart}`;
          const newToken = { ...noteToken, raw: newRaw };
          newTrack.push(newToken);
          console.log(`Optimizing Enharmonic: >${noteToken.raw}< -> ${newRaw}`);
          i += 3; // 3개의 토큰을 처리했으므로 인덱스를 3 증가
          continue;
        }

        // '<b>' 패턴 찾기
        if (
          i + 2 < track.length &&
          track[i].raw === "<" &&
          track[i + 1].type === "note" &&
          track[i + 1].raw.toLowerCase().startsWith("b") &&
          track[i + 2].raw === ">"
        ) {
          const noteToken = track[i + 1];
          const lengthPart = noteToken.raw.match(/\d*\.?/g).join("");
          const newRaw = `c-${lengthPart}`;
          const newToken = { ...noteToken, raw: newRaw };
          newTrack.push(newToken);
          console.log(`Optimizing Enharmonic: <${noteToken.raw}> -> ${newRaw}`);
          i += 3; // 3개의 토큰을 처리했으므로 인덱스를 3 증가
          continue;
        }

        // 패턴에 해당하지 않으면 현재 토큰을 그대로 추가
        newTrack.push(track[i]);
        i++;
      }
      newTracks.push(newTrack);
    }
    console.log("--- 이명동음 최적화 완료 ---");
    return newTracks;
  }
});
