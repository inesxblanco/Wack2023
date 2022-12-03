
/*

#loginError - Error for login modal
#registerError - Error for register modal


*/

async function makeRequest(endPoint, data) {
    return new Promise((resolve, reject) => {
        $.post(endPoint, data, (data) => {
            resolve(data);
        });
    });
}

function login(email, password, showError) {
    makeRequest("/login", { email: email, password: password }).then((data) => {
        if (data.success) {
            $('#loginError').text("");
            localStorage.setItem('UserId', data.UserId.toString());
            localStorage.setItem('token', data.tokenData.token);
            window.location.href = "profile.html";
        }
        else if (showError) {
            $('#loginError').text("Error: " + data.error);
        }
        // redirect
    });
}

function getUserData(redirect) {
    let userID = localStorage.getItem('UserId');
    let token = localStorage.getItem('token');

    makeRequest("/api/getUserData", { userID: userID, token: token }).then((data) => {
        if (data.success) {
            $('#loginMenu').text("My Profile");
            $("#logoutButton").show();
            $("#signupButton").hide();
            $("#signUpMenu").hide();
            if (redirect) {
                window.location.href = "profile.html";
            }
        }
        console.log(data);
    });
}

function loginPageEvents() {
    getUserData(false);
    $("#logoutButton").hide();

    $("#loginPassword").on("keyup", (e) => {
        if(e.key === 'Enter')
        {
            $('#loginButton').trigger("click");
        }
    });

    $('#registerPassword2').on("keyup", (e) => {
        if(e.key === 'Enter')
        {
            $('#registerButton').trigger("click");
        }
    });

    $('#loginMenu').on("click", () => {
        getUserData(true);
    });

    $('#loginButton').on("click", () => {
        const email = $('#loginEmail').val();
        const password = $('#loginPassword').val();
        login(email, password, true);
    });

    $('#logoutButton').on("click", () => {
        localStorage.removeItem('UserId');
        localStorage.removeItem('token');
        $('#loginMenu').text("Login");
        $("#logoutButton").hide();
        $("#signupButton").show();
        $("#signUpMenu").show();

    });

    $('#registerButton').on("click", () => {
        const email = $('#registerEmail').val();
        const password = $('#registerPassword').val();
        const password2 = $('#registerPassword2').val();
        const name = $('#registerName').val();

        if (password.length < 8) {
            $('#registerError').text("Error: Password is less than 8 characters.");
            return;
        }

        if (password !== password2) {
            $('#registerError').text("Error: Passwords do not match.");
            return;
        }

        makeRequest("/register", { email: email, password: password, name: name}).then((data) => {
            console.log(data);
            if (data.success) {
                $('#registerError').text("");
                login(email, password, true);
            }
            else {
                $('#registerError').text("Error: " + data.error);
            }
        }, (err) => {
            $('#registerError').text("Error: Connection to the server was rejected.");
        });
    });
}

function scheduleEvents(){
    let data = [
        {id: "timelineTeamBuilding", title: "Team Building Event", date: "Fri 17:00 - 20:00",
            desc: `This event will be for finding other group members to add to your team. 
        <br>Teams will be getting to know each other over some online games and will be hosted on the <a href="https://discord.gg/DcYgUufaHh">discord</a>.`},
        {id: "timelineInduction", title: "Induction", date: "Sat 11:00 - 12:00",
            desc: `This will be a livestream introducing us and your set hack goals, as well as our sponsors.
        We will also go through how we will run the rest of the event.`},
        {id: "timelineStart", title: "Hacking Starts!", date: "Sat 12:00",
            desc: `This is when the hacking officially begins! If you have any questions, please message the team.`},
        {id: "timelineTalk1", title: "Talk- Gerred Blyth", date: "Sat 13:00 - 13:45",
            desc: `Gerred, who has a wealth of knowledge on all things hackathon and UI/UX will be running a talk giving advice and answering some of your burning questions.<br/><br/>See <a href="#talks-link">Talks</a>`},
        {id: "timelineTalk2", title: "Talk- Anna Gidney", date: "Sat 14:00 - 14:45",
            desc: `Anna Gidney, our University of Bath Business Development Manager, will be giving a talk on being a woman in business. Come along to hear from a wonderful and relatable experienced professional who talks to businesses of all sizes every day!`},
        {id: "timelineNetworking", title: "Networking", date: "Sat 15:00 - 17:00",
            desc: `A dedicated time slot to network with Kirsty Carotti from BMT, and Barry and Dylan from Storm!`},
        {id: "timelineTalk3", title: "Technical Labs Talk", date: "Sat 17:00 - 18:00",
            desc: `The team that ran BCSS Technical Labs will be running through their lab on git 101 and web dev. A great time to learn some of the beginner Hackathon tricks and tips on the technical side.`},
        {id: "timelineBreak", title: "Break", date: "Sat 19:00",
            desc: `Time to take a break and have some dinner! Come find us in the social channel for some company!`},
        {id: "timelineEndTalk", title: "End of Hacking Talk", date: "Sun 10:00",
            desc: `A talk to let you know how to submit your work and start the end of the hack!`},
        {id: "timelineEnd", title: "Hacking Ends", date: "Sun 12:00",
            desc: `Hacking ends at midday on Sunday, so make sure you get everything submitted!
        <br><br> You will need to submit a simple 1-3 minute demo video (uploaded to YouTube) showing off what you've made, 
        as well as a basic written explanation. You can submit over Devpost - more information will be provided on how to submit during the event.
        We'd like you to also submit evidence of your codebase, for example a GitHub link.
        <br><br>For now, you're free! We'll take a break until 1pm to look through the submissions and let everyone have a quick break :)`},
        {id: "timelineJudge", title: "Judging/Showcase", date: "Sun 13:00 - 15:00",
            desc: `During this window, we will play all the demo videos over the livestream so the other groups can see what has been made.
        <br><br>While we do this, the judges will make their way around various Discord voice channels, asking a couple of questions about the project.
        This is another chance for you to show off, so please do make sure you're in a free voice channel while the judging is taking place!`},
        {id: "timelineWinners", title: "Announce winners/Closing Ceremony", date: "Sun 15:20",
            desc: `Once judging has been finalised, we will announce the winners on the livestream, and then bring the hackathon to a close.
        <br><br>We hope you've had a good time!`},
    ];

    data.forEach(e => {
        $(`#timeline-items`).append(`
        <a id="${e.id}" data-dismiss="modal" data-toggle="modal"
        data-target="#timelineModal">
            <li class="timeline-item" data-date="${e.date}">
                ${e.title}
            </li>
        </a>
        `);
        $(`#`+e.id).on("click", () => {
            $(`#timeline-modal-header`).html(e.title);
            $(`#timeline-modal-body`).html(e.desc);
        });
    });
}

$(function() { 
    loginPageEvents();
    scheduleEvents();
});