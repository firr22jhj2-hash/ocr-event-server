async function uploadImage() {
    const fileInput = document.getElementById("fileInput");
    if (!fileInput.files.length) {
        alert("이미지를 선택해주세요!");
        return;
    }

    const formData = new FormData();
    formData.append("image", fileInput.files[0]);

    const response = await fetch("http://localhost:5000/upload", {
        method: "POST",
        body: formData
    });

    const data = await response.json();

    const resultDiv = document.getElementById("result");

    if (!data.success) {
        resultDiv.innerHTML = "❌ 텍스트를 인식하지 못했습니다.";
        return;
    }

    const nickname = data.text.split("\n")[0].trim(); // 첫 줄만 추출

    // IP + 닉네임 중복 체크 요청
    const check = await fetch("http://localhost:5000/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname })
    }).then(res => res.json());

    if (!check.ok) {
        resultDiv.innerHTML = `⚠️ ${nickname} 님은 이미 제출하셨습니다.`;
        return;
    }

    // 신규 제출 저장
    await fetch("http://localhost:5000/save", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ nickname })
    });

    resultDiv.innerHTML = `🎉 ${nickname} 고객님! 제출이 완료되었습니다.<br><br>이 화면을 담당자에게 보여주세요.`;
}
