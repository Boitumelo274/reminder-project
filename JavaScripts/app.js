(function () {
  var anim = false,
    dip = null,
    KEY = "remindr:v2",
    OLD = "remindr:v1",
    items = [],
    tab = "home",
    cat = "All",
    calM = new Date(),
    selDay = null,
    editId = null,
    alerted = {},
    selDays = [];
  var DN = ["S", "M", "T", "W", "T", "F", "S"];
  function $(i) {
    return document.getElementById(i);
  }
  function pad(n) {
    return n < 10 ? "0" + n : "" + n;
  }
  function esc(s) {
    var d = document.createElement("div");
    d.textContent = s;
    return d.innerHTML;
  }
  function load() {
    try {
      var r = localStorage.getItem(KEY) || localStorage.getItem(OLD);
      items = r ? JSON.parse(r) : [];
    } catch (e) {
      items = [];
    }
    items.forEach(function (i) {
      i.log = i.log || [];
      i.days = i.days || [];
      i.cat = i.cat || "";
    });
  }
  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(items));
    } catch (e) {}
    mirror();
  }
  function idb(cb) {
    try {
      var r = indexedDB.open("remindr", 1);
      r.onupgradeneeded = function () {
        r.result.createObjectStore("kv");
      };
      r.onsuccess = function () {
        cb(r.result);
      };
      r.onerror = function () {};
    } catch (e) {}
  }
  function mirror() {
    idb(function (db) {
      try {
        db.transaction("kv", "readwrite")
          .objectStore("kv")
          .put(JSON.parse(JSON.stringify(items)), "items");
      } catch (e) {}
    });
  }
  function rel(t) {
    var s = Math.round((t - Date.now()) / 60000),
      a = Math.abs(s),
      u;
    if (a < 1) return "now";
    if (a < 60) u = a + "m";
    else if (a < 1440)
      u = Math.floor(a / 60) + "h" + (a % 60 ? " " + (a % 60) + "m" : "");
    else u = Math.floor(a / 1440) + "d";
    return s > 0 ? "in " + u : u + " ago";
  }
  function greet() {
    var h = new Date().getHours(),
      g =
        h < 5
          ? "Still up?"
          : h < 12
            ? "Good morning"
            : h < 18
              ? "Good afternoon"
              : "Good evening";
    $("greet").textContent =
      g +
      " · " +
      new Date().toLocaleDateString([], {
        weekday: "long",
        day: "numeric",
        month: "long",
      });
  }
  function notify(it) {
    if (!("Notification" in window) || Notification.permission !== "granted")
      return;
    var o = {
      body: it.note || "It’s time.",
      tag: it.id + ":" + it.due,
      icon: "icon-192.png",
      badge: "icon-192.png",
      vibrate: [200, 100, 200],
      data: { id: it.id },
    };
    if (swReg && swReg.showNotification) {
      swReg.showNotification(it.title, o).catch(function () {
        try {
          new Notification(it.title, o);
        } catch (e) {}
      });
    } else {
      try {
        new Notification(it.title, o);
      } catch (e) {}
    }
  }
  function permText() {
    return "Notification" in window
      ? { granted: "on", denied: "blocked", default: "not enabled yet" }[
          Notification.permission
        ] || "unknown"
      : "not supported in this browser";
  }
  function testNotif() {
    if (!("Notification" in window) || Notification.permission !== "granted") {
      askPerm();
      return;
    }
    notify({
      id: "test",
      due: Date.now(),
      title: "Test reminder",
      note: "Notifications are working.",
    });
  }
  function dk(t) {
    var d = new Date(t);
    return (
      d.getFullYear() + "-" + pad(d.getMonth() + 1) + "-" + pad(d.getDate())
    );
  }
  function fmt(t) {
    return new Date(t).toLocaleString([], {
      weekday: "short",
      day: "numeric",
      month: "short",
      hour: "2-digit",
      minute: "2-digit",
    });
  }
  function sw() {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7));
    return d.getTime();
  }
  function sm() {
    var d = new Date();
    return new Date(d.getFullYear(), d.getMonth(), 1).getTime();
  }
  function hue(s) {
    var h = 0;
    for (var i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) % 360;
    return h;
  }
  function dot(c) {
    return c
      ? '<span class="dot" style="background:hsl(' +
          hue(c) +
          ',55%,50%)"></span>'
      : "";
  }
  function nextDue(it) {
    var d = new Date(it.due),
      now = Date.now(),
      n = 0;
    do {
      n++;
      if (it.repeat === "daily") d.setDate(d.getDate() + 1);
      else if (it.repeat === "weekdays") {
        do {
          d.setDate(d.getDate() + 1);
        } while (d.getDay() === 0 || d.getDay() === 6);
      } else if (it.repeat === "custom" && it.days.length) {
        do {
          d.setDate(d.getDate() + 1);
        } while (it.days.indexOf(d.getDay()) < 0);
      } else if (it.repeat === "weekly") d.setDate(d.getDate() + 7);
      else if (it.repeat === "monthly") d.setMonth(d.getMonth() + 1);
      else d.setDate(d.getDate() + 1);
    } while (d.getTime() <= now && n < 800);
    return d.getTime();
  }
  function rep(it) {
    return it.repeat === "none"
      ? ""
      : it.repeat === "custom"
        ? " · " +
          it.days
            .slice()
            .sort()
            .map(function (x) {
              return ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][x];
            })
            .join(", ")
        : it.repeat === "weekdays"
          ? " · Mon–Fri"
          : " · " + it.repeat;
  }
  function prog(it) {
    if (!it.goalN) return null;
    var s = it.goalPer === "month" ? sm() : sw();
    return {
      c: it.log.filter(function (t) {
        return t >= s;
      }).length,
      n: it.goalN,
    };
  }
  function streak() {
    var days = {};
    items.forEach(function (i) {
      i.log.forEach(function (t) {
        days[dk(t)] = 1;
      });
    });
    var n = 0,
      d = new Date();
    if (!days[dk(d)]) d.setDate(d.getDate() - 1);
    while (days[dk(d)]) {
      n++;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }
  function toast(msg, id) {
    var el = document.createElement("div");
    el.className = "toast";
    el.innerHTML = "<span>" + esc(msg) + "</span>";
    if (id) {
      var b = document.createElement("button");
      b.className = "sm";
      b.textContent = "Snooze 10m";
      b.onclick = function () {
        snooze(id, 10);
        el.remove();
      };
      el.appendChild(b);
    }
    var x = document.createElement("button");
    x.className = "sm";
    x.textContent = "OK";
    x.onclick = function () {
      el.remove();
    };
    el.appendChild(x);
    $("toasts").appendChild(el);
    if (!id)
      setTimeout(function () {
        el.remove();
      }, 4000);
  }
  function beep() {
    try {
      var a = new (window.AudioContext || window.webkitAudioContext)(),
        o = a.createOscillator(),
        g = a.createGain();
      o.connect(g);
      g.connect(a.destination);
      o.frequency.value = 880;
      g.gain.value = 0.08;
      o.start();
      o.stop(a.currentTime + 0.25);
    } catch (e) {}
    try {
      navigator.vibrate && navigator.vibrate([200, 100, 200]);
    } catch (e) {}
  }
  function check() {
    var now = Date.now();
    items.forEach(function (it) {
      var k = it.id + ":" + it.due;
      if (!it.finished && it.due <= now && !alerted[k]) {
        alerted[k] = 1;
        toast("Reminder: " + it.title, it.id);
        beep();
        notify(it);
      }
    });
    if (!$("sheet").classList.contains("on")) render();
  }
  function complete(id) {
    var it = find(id);
    if (!it) return;
    it.log.push(Date.now());
    if (it.repeat === "none") it.finished = true;
    else it.due = nextDue(it);
    save();
    render();
  }
  function snooze(id, m) {
    var it = find(id);
    if (!it) return;
    it.due = Date.now() + m * 60000;
    save();
    render();
  }
  function find(id) {
    return items.find(function (x) {
      return x.id === id;
    });
  }
  function card(it) {
    var over = it.due <= Date.now() && !it.finished,
      p = prog(it);
    var h =
      '<div class="card item"><button class="chk" data-a="done" data-id="' +
      it.id +
      '" aria-label="Mark done"></button><div class="mn">';
    h += '<div class="t">' + dot(it.cat) + esc(it.title) + "</div>";
    h +=
      '<div class="m ' +
      (over ? "due" : "") +
      '">' +
      (over ? "Overdue · " : "") +
      rel(it.due) +
      " · " +
      fmt(it.due) +
      rep(it) +
      (it.cat ? " · " + esc(it.cat) : "") +
      "</div>";
    if (it.note) h += '<div class="m">' + esc(it.note) + "</div>";
    if (p)
      h +=
        '<div class="m">' +
        p.c +
        " of " +
        p.n +
        " this " +
        it.goalPer +
        '</div><div class="bar"><i style="width:' +
        Math.min(100, (p.c / p.n) * 100) +
        '%"></i></div>';
    h +=
      '<div class="acts"><button class="sm" data-a="s10" data-id="' +
      it.id +
      '">+10 min</button><button class="sm" data-a="s60" data-id="' +
      it.id +
      '">+1 hr</button><button class="sm" data-a="s1d" data-id="' +
      it.id +
      '">Tomorrow</button><button class="sm" data-a="edit" data-id="' +
      it.id +
      '">Edit</button><button class="sm" data-a="del" data-id="' +
      it.id +
      '">Delete</button></div></div></div>';
    return h;
  }
  function cats() {
    var s = [];
    items.forEach(function (i) {
      if (i.cat && s.indexOf(i.cat) < 0) s.push(i.cat);
    });
    return s;
  }
  function render() {
    greet();
    var now = Date.now(),
      act = items
        .filter(function (i) {
          return !i.finished;
        })
        .sort(function (a, b) {
          return a.due - b.due;
        }),
      h = "";
    $("cats").innerHTML = ["Study", "Gym", "Personal", "Work", "Health"]
      .concat(cats())
      .map(function (c) {
        return '<option value="' + esc(c) + '">';
      })
      .join("");
    if (tab === "home") {
      var td = dk(now),
        tdn = act.filter(function (i) {
          return i.due <= now;
        }).length,
        dn = 0;
      items.forEach(function (i) {
        i.log.forEach(function (t) {
          if (dk(t) === td) dn++;
        });
      });
      h =
        '<div class="stats"><div class="card"><b>' +
        tdn +
        '</b><span class="m">due now</span></div><div class="card"><b>' +
        dn +
        '</b><span class="m">done today</span></div><div class="card"><b>' +
        streak() +
        '</b><span class="m">day streak</span></div></div>';
      var cs = cats();
      if (cat !== "All" && cs.indexOf(cat) < 0) cat = "All";
      if (cs.length) {
        h +=
          '<div class="chips">' +
          ["All"]
            .concat(cs)
            .map(function (c) {
              return (
                '<button class="chip ' +
                (c === cat ? "on" : "") +
                '" data-cat="' +
                esc(c) +
                '">' +
                esc(c) +
                "</button>"
              );
            })
            .join("") +
          "</div>";
      }
      var f = act.filter(function (i) {
        return cat === "All" || i.cat === cat;
      });
      var end = new Date();
      end.setHours(23, 59, 59, 999);
      var a = f.filter(function (i) {
          return i.due <= end.getTime();
        }),
        b = f.filter(function (i) {
          return i.due > end.getTime();
        });
      h +=
        "<h2>Today & overdue</h2>" +
        (a.map(card).join("") ||
          '<div class="empty">All clear for today.</div>');
      h +=
        "<h2>Upcoming</h2>" +
        (b.map(card).join("") ||
          '<div class="empty">Nothing upcoming. Tap + to add one.</div>');
    } else if (tab === "cal") {
      var y = calM.getFullYear(),
        mo = calM.getMonth(),
        first = new Date(y, mo, 1),
        off = (first.getDay() + 6) % 7,
        days = new Date(y, mo + 1, 0).getDate(),
        by = {};
      act.forEach(function (i) {
        var k = dk(i.due);
        (by[k] = by[k] || []).push(i);
      });
      h =
        '<div class="top"><button class="sm" data-a="pm">‹</button><b>' +
        first.toLocaleString([], { month: "long", year: "numeric" }) +
        '</b><button class="sm" data-a="nm">›</button></div><div class="cal">';
      ["M", "T", "W", "T", "F", "S", "S"].forEach(function (x) {
        h += '<div class="h">' + x + "</div>";
      });
      for (var i = 0; i < off; i++) h += "<div></div>";
      for (var d = 1; d <= days; d++) {
        var k = y + "-" + pad(mo + 1) + "-" + pad(d);
        h +=
          '<button data-day="' +
          k +
          '" class="' +
          (k === dk(now) ? "today " : "") +
          (k === selDay ? "sel" : "") +
          '">' +
          d +
          (by[k] ? "<i></i>" : "") +
          "</button>";
      }
      h += "</div>";
      if (selDay) {
        h +=
          "<h2>" +
          new Date(selDay + "T12:00").toLocaleDateString([], {
            weekday: "long",
            day: "numeric",
            month: "long",
          }) +
          "</h2>" +
          ((by[selDay] || []).map(card).join("") ||
            '<div class="empty">Nothing due this day.</div>');
      } else h += '<div class="empty">Tap a day to see what is due.</div>';
    } else if (tab === "goals") {
      var g = items.filter(function (i) {
        return i.goalN;
      });
      h =
        "<h2>Weekly and monthly goals</h2>" +
        (g.map(card).join("") ||
          '<div class="empty">No goals yet. Set “how many times” when adding a reminder.</div>');
    } else if (tab === "hist") {
      var all = [];
      items.forEach(function (i) {
        i.log.forEach(function (t) {
          all.push({ t: t, i: i });
        });
      });
      all.sort(function (a, b) {
        return b.t - a.t;
      });
      h =
        "<h2>Completed</h2>" +
        (all
          .slice(0, 80)
          .map(function (e) {
            return (
              '<div class="card"><div class="t">' +
              dot(e.i.cat) +
              esc(e.i.title) +
              '</div><div class="m">Done ' +
              fmt(e.t) +
              "</div></div>"
            );
          })
          .join("") ||
          '<div class="empty">Completed reminders show up here.</div>');
    } else {
      h =
        '<h2>Backup</h2><div class="card"><div class="m" style="margin-bottom:10px">Your data lives in this browser. Export a copy to keep it safe or move it to another device.</div><div class="row"><button id="exp">Export backup</button><button id="imp">Import backup</button></div></div>';
      h +=
        '<h2>Notifications</h2><div class="card"><div class="m" style="margin-bottom:10px">Status: <b>' +
        permText() +
        '</b>. Reminders alert while the app is open or recently used. Install it to your home screen and keep notifications allowed for best results.</div><div class="row"><button id="perm">Allow notifications</button><button id="tst">Send test</button></div></div>';
      h +=
        '<h2>Install</h2><div class="card"><div class="m" style="margin-bottom:10px">iPhone: open in Safari, tap Share, then “Add to Home Screen”.<br>Android: tap ⋮ in Chrome, then “Install app”.</div>' +
        (dip ? '<button id="inst" class="pri">Install app</button>' : "") +
        "</div>";
      h +=
        '<h2>Danger zone</h2><div class="card"><button id="clr">Delete all reminders</button></div>';
    }
    $("view").innerHTML = h;
    if (anim) {
      anim = false;
      var vw = $("view");
      vw.classList.add("anim");
      setTimeout(function () {
        vw.classList.remove("anim");
      }, 700);
    }
  }
  $("view").addEventListener("click", function (e) {
    var c = e.target.closest("[data-cat]");
    if (c) {
      cat = c.dataset.cat;
      render();
      return;
    }
    var dd = e.target.closest("[data-day]");
    if (dd) {
      selDay = dd.dataset.day;
      render();
      return;
    }
    var b = e.target.closest("[data-a]");
    if (b) {
      var a = b.dataset.a,
        id = b.dataset.id;
      if (a === "done") {
        b.disabled = true;
        var cd = b.closest(".card");
        if (cd) cd.classList.add("gone");
        try {
          navigator.vibrate && navigator.vibrate(30);
        } catch (x) {}
        setTimeout(function () {
          complete(id);
        }, 260);
      } else if (a === "del") {
        if (confirm("Delete this reminder?")) {
          items = items.filter(function (x) {
            return x.id !== id;
          });
          save();
          render();
        }
      } else if (a === "s10") snooze(id, 10);
      else if (a === "s60") snooze(id, 60);
      else if (a === "s1d") snooze(id, 1440);
      else if (a === "edit") openForm(id);
      else if (a === "pm") {
        calM = new Date(calM.getFullYear(), calM.getMonth() - 1, 1);
        render();
      } else if (a === "nm") {
        calM = new Date(calM.getFullYear(), calM.getMonth() + 1, 1);
        render();
      }
      return;
    }
    if (e.target.id === "exp") exportData();
    if (e.target.id === "tst") testNotif();
    if (e.target.id === "perm") askPerm();
    if (e.target.id === "inst" && dip) {
      dip.prompt();
      dip = null;
      render();
    }
    if (e.target.id === "imp") $("file").click();
    if (
      e.target.id === "clr" &&
      confirm("Delete ALL reminders and history? This can’t be undone.")
    ) {
      items = [];
      save();
      render();
    }
  });
  $("nav").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    tab = b.dataset.t;
    anim = true;
    Array.prototype.forEach.call($("nav").children, function (c) {
      c.classList.toggle("on", c === b);
    });
    render();
    window.scrollTo(0, 0);
  });
  function drawDays() {
    $("days").innerHTML = DN.map(function (n, i) {
      return (
        '<button type="button" data-d="' +
        i +
        '" class="' +
        (selDays.indexOf(i) >= 0 ? "on" : "") +
        '">' +
        n +
        "</button>"
      );
    }).join("");
  }
  $("days").addEventListener("click", function (e) {
    var b = e.target.closest("button");
    if (!b) return;
    var d = +b.dataset.d,
      i = selDays.indexOf(d);
    if (i < 0) selDays.push(d);
    else selDays.splice(i, 1);
    drawDays();
  });
  $("repeat").addEventListener("change", function () {
    $("days").style.display = $("repeat").value === "custom" ? "flex" : "none";
  });
  function lv(t) {
    var d = new Date(t);
    return (
      d.getFullYear() +
      "-" +
      pad(d.getMonth() + 1) +
      "-" +
      pad(d.getDate()) +
      "T" +
      pad(d.getHours()) +
      ":" +
      pad(d.getMinutes())
    );
  }
  function openForm(id) {
    editId = id || null;
    var it = id ? find(id) : null;
    $("sheetTitle").textContent = it ? "Edit reminder" : "New reminder";
    $("title").value = it ? it.title : "";
    $("note").value = it ? it.note : "";
    $("cat").value = it ? it.cat : cat !== "All" ? cat : "";
    var d = new Date(
      selDay && tab === "cal" ? selDay + "T09:00" : Date.now() + 3600000,
    );
    if (!it && !(selDay && tab === "cal")) {
      d.setMinutes(0, 0, 0);
    }
    $("due").value = lv(it ? it.due : d.getTime());
    $("repeat").value = it ? it.repeat : "none";
    selDays = it ? it.days.slice() : [];
    drawDays();
    $("days").style.display = $("repeat").value === "custom" ? "flex" : "none";
    $("goalN").value = it && it.goalN ? it.goalN : "";
    $("goalPer").value = it ? it.goalPer : "week";
    $("sheet").classList.add("on");
  }
  function closeForm() {
    $("sheet").classList.remove("on");
    render();
  }
  $("fab").onclick = function () {
    openForm();
  };
  $("cancel").onclick = closeForm;
  $("sheet").addEventListener("click", function (e) {
    if (e.target === $("sheet")) closeForm();
  });
  $("form").addEventListener("submit", function (e) {
    e.preventDefault();
    var due = new Date($("due").value).getTime();
    if (isNaN(due)) return;
    var r = $("repeat").value;
    if (r === "custom" && !selDays.length) {
      toast("Pick at least one day.");
      return;
    }
    var n = parseInt($("goalN").value, 10),
      o = {
        title: $("title").value.trim(),
        note: $("note").value.trim(),
        cat: $("cat").value.trim(),
        due: due,
        repeat: r,
        days: r === "custom" ? selDays.slice() : [],
        goalN: n > 0 ? n : 0,
        goalPer: $("goalPer").value,
      };
    if (editId) {
      var it = find(editId);
      Object.keys(o).forEach(function (k) {
        it[k] = o[k];
      });
      it.finished = false;
    } else {
      o.id =
        "r" + Date.now().toString(36) + Math.random().toString(36).slice(2, 5);
      o.log = [];
      o.finished = false;
      items.push(o);
    }
    save();
    anim = true;
    closeForm();
    check();
  });
  function exportData() {
    var blob = new Blob(
      [JSON.stringify({ app: "remindr", v: 2, items: items }, null, 1)],
      { type: "application/json" },
    );
    var a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "remindr-backup-" + dk(Date.now()) + ".json";
    document.body.appendChild(a);
    a.click();
    setTimeout(function () {
      URL.revokeObjectURL(a.href);
      a.remove();
    }, 500);
    toast("Backup downloaded.");
  }
  $("file").addEventListener("change", function () {
    var f = $("file").files[0];
    if (!f) return;
    var r = new FileReader();
    r.onload = function () {
      try {
        var j = JSON.parse(r.result);
        if (!j || !Array.isArray(j.items)) throw 0;
        if (
          confirm(
            "Replace your current reminders with " +
              j.items.length +
              " from this backup?",
          )
        ) {
          items = j.items.filter(function (i) {
            return i && i.id && typeof i.title === "string" && isFinite(i.due);
          });
          items.forEach(function (i) {
            i.log = i.log || [];
            i.days = i.days || [];
            i.cat = i.cat || "";
          });
          save();
          render();
          toast("Backup imported.");
        }
      } catch (e) {
        toast("That file isn’t a Remindr backup.");
      }
      $("file").value = "";
    };
    r.readAsText(f);
  });
  function alertState() {
    $("alertBtn").style.display =
      "Notification" in window && Notification.permission === "granted"
        ? "none"
        : "";
  }
  function regPS() {
    try {
      if (
        swReg &&
        swReg.periodicSync &&
        "Notification" in window &&
        Notification.permission === "granted"
      )
        swReg.periodicSync
          .register("remindr-check", { minInterval: 900000 })
          .catch(function () {});
    } catch (e) {}
  }
  function askPerm() {
    if (!("Notification" in window)) {
      toast(
        "Notifications aren’t supported here. On iPhone, add the app to your Home Screen first, then open it from there.",
      );
      return;
    }
    Promise.resolve(Notification.requestPermission())
      .then(function () {
        alertState();
        regPS();
        render();
        toast(
          Notification.permission === "granted"
            ? "Notifications enabled."
            : "Notifications are blocked. Allow them in your phone or browser settings.",
        );
      })
      .catch(function () {});
  }
  $("alertBtn").addEventListener("click", askPerm);
  window.addEventListener("beforeinstallprompt", function (e) {
    e.preventDefault();
    dip = e;
    if (tab === "more") render();
  });
  window.addEventListener("appinstalled", function () {
    dip = null;
    toast("Installed. Open Remindr from your home screen.");
    if (tab === "more") render();
  });
  var swReg = null;
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("sw.js").catch(function () {});
    navigator.serviceWorker.ready
      .then(function (r) {
        swReg = r;
        regPS();
      })
      .catch(function () {});
    navigator.serviceWorker.addEventListener("message", function (e) {
      if (e.data && e.data.type === "focus-reminder") {
        tab = "home";
        anim = true;
        render();
      }
    });
  }
  try {
    navigator.storage &&
      navigator.storage.persist &&
      navigator.storage.persist();
  } catch (e) {}
  load();
  mirror();
  alertState();
  anim = true;
  render();
  check();
  setInterval(check, 15000);
  document.addEventListener("visibilitychange", function () {
    if (!document.hidden) check();
  });
})();
