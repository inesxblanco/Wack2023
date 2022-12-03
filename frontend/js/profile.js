const RESEND_EMAIL_TIMEOUT = 1000 * 20;
let resendTimeOut = null;

async function makeRequest(endPoint, data) {
    return new Promise((resolve, reject) => {
        $.post(endPoint, data, (data) => {
            resolve(data);
        });
    });
}

async function getUserData(redirect) {
    return new Promise(async (resolve, reject)  =>  {
        let userID = localStorage.getItem('UserId');
        let token = localStorage.getItem('token');

        let data = await makeRequest("/api/getUserData", { userID: userID, token: token });

        if (data.success) {
           $('#verifyEmail').hide(); // Hides all verification messages
           $("#resendNot").hide();

           $('#mainProfile').show(); // Shows main profile section

            resolve(data);
        }
        else if (redirect) {
            if (data.error == "User not verified.") {
                $('#mainProfile').hide(); // Hides main profile section

                $('#verifyEmail').show(); // Shows email verification message
                $("#resendNot").hide(); // Hides "Email sent" section

                $('#resendBtn').on("click", async () => {
                    if (resendTimeOut == null){
                        resendTimeOut = Date.now();
                    } else if (Date.now() - resendTimeOut < RESEND_EMAIL_TIMEOUT) {
                        return;
                    }
                    let x = await makeRequest("/api/resendVer", { userID: userID, token: token });
                    if (x.success) {
                        $('#resendNot').show(); // Shows "Email sent" section
                    }
                    else {
                        tokenFail();
                    }
                });
            }
            else {
                tokenFail();
            }
        }
    });
}

function printGroupList(data) {
    let html = ``;
    for (var i = 0; i < data.group.length; i++) {
        html += `<div class="row text-left">
        <div class="col-md-3"> • ` + data.group[i].UserEmail + `</div>
        <div class="col-md-9">` + data.group[i].UserName + `</div>
        </div>`;
    }
    $('#groupList').html(html);
}

function copyToClipboard(data) {
    var $temp = $("<input>");
    $("body").append($temp);
    $temp.val(data).trigger("select");
    document.execCommand("copy");
    $temp.remove();
}

async function updateGroupInfo() {
    let data = await getUserData(true);

    if (data.GroupId !== null) {
        $('#createGroupBtn').hide();
        $('#leaveGroupBtn').show();
        $('#groupList').show();
        $('#groupExists').show();
        $('#groupCodeDiv').hide();
        $('#groupCode').text(data.Code);
        printGroupList(data);
    }
    else {
        $('#groupCodeDiv').show();
        $('#createGroupBtn').show();
        $('#leaveGroupBtn').hide();
        $('#groupExists').hide();
        $('#groupList').hide();
    }
    return data;
}

async function updateCVInfo(userID, token) {
    let data = await makeRequest("/api/fileUploaded", { userID: userID, token: token });
    if (data.success) {
        if (data.data.exists) {
            $('#fileNameField').html(data.data.name);
            $('#deleteFileBtn').show();
            $('#currentCV').show();
            $("#cvUpload").hide();
        }
        else {
            $('#currentCV').hide();
            $('#deleteFileBtn').hide();
            $("#cvUpload").show();

        }
    }
    else {
        tokenFail();
    }
}

function tokenFail() {
    alert("Your token has expired, and you have been logged out!");
    window.location.href = "../";
}

async function profilePageEvents() {
    let data = await updateGroupInfo();

    let userID = localStorage.getItem('UserId');
    let token = localStorage.getItem('token');



    await updateCVInfo(userID, token);

    $('#logoutButton').on("click", () => {
        localStorage.removeItem('UserId');
        localStorage.removeItem('token');
        window.location.href = "../";
    });

    $('#shareField').on("change", async () => {
        let data = await makeRequest("/api/sendContactInfo", { userID: userID, val: Boolean($("#shareField")[0].checked), token: token });
        if (!data.success) {
            alert("Connection to the server failed.");
        }
    });



    $("#customFile").on("change", function() {
        var fileName = $(this).val().split("\\").pop();
        let file = $('#customFile')[0].files[0];
        if (file.type != "application/pdf") {
            $('#customFile')[0].value = "";
            alert("File must be PDF.");
            $('#customFileLabel').html("Choose file");

        }
        else {
            $('#customFileLabel').html(fileName);
        }
    });
    $('#emailField').text(data.UserEmail);
    $('#nameField').text(data.UserName);

    $('#shareField').prop("checked", data.SendContactInfo);
    $('#deleteModalBtn').show();

    $('#copyCodeBtn').on("click", async () => {
        let data = await getUserData(true);

        if (navigator.clipboard) {
            navigator.clipboard.writeText($("#groupCode").html());
        }
        else {
            copyToClipboard(data.group[0].Code);
        }

        $('#copiedNot').show();
    });

    $('#createGroupBtn').on("click", async () => {
        let x = await makeRequest("/api/addGroup", { userID: userID, token: token });
        if (x.success) {
            updateGroupInfo();
        }
        else {
            tokenFail();
        }
    });

    $('#leaveGroupBtn').on("click", async () => {
        let x = await makeRequest("/api/removeUserFromGroup", { userID: userID, token: token });
        if (x.success) {
            updateGroupInfo();
        }
        else {
            tokenFail();
        }
    });

    $('#joinGroupBtn').on("click", async () => {
        groupCode = $('#groupCodeInput').val();
        let x = await makeRequest("/api/joinGroup", { userID: userID, token: token, groupCode: groupCode });
        if (x.success) {
            updateGroupInfo();
        }
        else if (x.error == "User token expired." || x.error == "Invalid token.") {
            tokenFail();
        }
        else {
            $('#joinGroupError').text("Error: " + x.error);
        }
    });

    $('#deleteAccBtn').on("click", async () => {
        let x = await makeRequest("/api/removeUser", { userID: userID, token: token });
        if (x.success) {
            window.location.href = "../";
        }
        else {
            tokenFail();
        }
    });

    $('#uploadBtn').on("click", async () => {
        let file = $('#customFile')[0].files[0];
        if (file == undefined) {
            return;
        }
        let formData = new FormData();
     
        formData.append("file", file);
        formData.append("userID", userID);
        formData.append("token", token);

        $.ajax({
            url: '/api/uploadFile',
            data: formData,
            processData: false,
            contentType: false,
            type: 'POST',
            success: async function(data){
                if (data.success) {
                    await updateCVInfo(userID, token);
                }
                else {
                    tokenFail();
                }
            }
        });
    });

    $('#deleteFileBtn').on("click", async () => {
        let x = await makeRequest("/api/removeFile", { userID: userID, token: token });
        if (x.success) {
            await updateCVInfo(userID, token);
        }
        else {
            tokenFail();
        }
    });
}

$(function () {
    profilePageEvents();
});