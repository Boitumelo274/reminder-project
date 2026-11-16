(function () {
  var anim = false,
    dip = null,
    ac = null,
    wk = 0,
    prefs = { sound: "chime", vol: 0.6, vib: true, custom: "" },
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
  function hero(dn, left) {
    var tot = dn + left,
      p = tot ? dn / tot : 0,
      C = 2 * Math.PI * 34,
      off = C * (1 - p);
    var msg =
      left === 0
        ? dn
          ? "All done. Nice work!"
          : "Nothing planned yet"
        : left + (left === 1 ? " reminder" : " reminders") + " left today";
    return (
      '<div class="hero"><div><div class="hk">TODAY</div><div class="hm">' +
      msg +
      '</div><div class="m hs">' +
      dn +
      " done · " +
      streak() +
      ' day streak</div></div><svg class="ring" viewBox="0 0 80 80" aria-hidden="true"><circle cx="40" cy="40" r="34" class="rt"/><circle cx="40" cy="40" r="34" class="rp" style="stroke-dasharray:' +
      C.toFixed(1) +
      ";stroke-dashoffset:" +
      off.toFixed(1) +
      '" transform="rotate(-90 40 40)"/><text x="40" y="46" text-anchor="middle" class="rx">' +
      Math.round(p * 100) +
      "%</text></svg></div>"
    );
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
      vibrate: prefs.vib ? [200, 100, 200] : [],
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
    playSound();
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
  var SND = {
    chime: {
      n: "Chime",
      w: "sine",
      t: [
        [784, 0, 0.18],
        [988, 0.15, 0.18],
        [1319, 0.3, 0.4],
      ],
    },
    bell: {
      n: "Bell",
      w: "triangle",
      t: [
        [660, 0, 0.9],
        [1320, 0, 0.5],
      ],
    },
    pulse: {
      n: "Pulse",
      w: "square",
      t: [
        [520, 0, 0.12],
        [520, 0.2, 0.12],
        [520, 0.4, 0.12],
      ],
    },
    beep: { n: "Beep", w: "sine", t: [[880, 0, 0.25]] },
    soft: {
      n: "Soft",
      w: "sine",
      t: [
        [440, 0, 0.4],
        [554, 0.2, 0.55],
      ],
    },
  };
  function loadPrefs() {
    try {
      var p = JSON.parse(localStorage.getItem("remindr:prefs") || "{}");
      for (var k in p) prefs[k] = p[k];
    } catch (e) {}
    if (
      prefs.sound !== "silent" &&
      prefs.sound !== "custom" &&
      !SND[prefs.sound]
    )
      prefs.sound = "chime";
    if (prefs.sound === "custom" && !prefs.custom) prefs.sound = "chime";
  }
  function savePrefs() {
    try {
      localStorage.setItem("remindr:prefs", JSON.stringify(prefs));
    } catch (e) {
      toast("Couldn’t save that setting.");
    }
  }
  function playSound(id) {
    id = id || prefs.sound;
    try {
      if (id === "silent") return;
      if (id === "custom" && prefs.custom) {
        var au = new Audio(prefs.custom);
        au.volume = prefs.vol;
        var pp = au.play();
        if (pp && pp.catch) pp.catch(function () {});
        return;
      }
      var d = SND[id] || SND.chime;
      ac = ac || new (window.AudioContext || window.webkitAudioContext)();
      if (ac.state === "suspended") ac.resume();
      var t0 = ac.currentTime,
        v = Math.max(0.002, prefs.vol * 0.3);
      d.t.forEach(function (n) {
        var o = ac.createOscillator(),
          g = ac.createGain();
        o.type = d.w;
        o.frequency.value = n[0];
        o.connect(g);
        g.connect(ac.destination);
        g.gain.setValueAtTime(0.0001, t0 + n[1]);
        g.gain.exponentialRampToValueAtTime(v, t0 + n[1] + 0.02);
        g.gain.exponentialRampToValueAtTime(0.0001, t0 + n[1] + n[2]);
        o.start(t0 + n[1]);
        o.stop(t0 + n[1] + n[2] + 0.05);
      });
    } catch (e) {}
  }
  function beep() {
    playSound();
    try {
      if (prefs.vib && navigator.vibrate) navigator.vibrate([200, 100, 200]);
    } catch (e) {}
  }
  function wkStart(o) {
    var d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() - ((d.getDay() + 6) % 7) + o * 7);
    return d.getTime();
  }
  function review() {
    var s = wkStart(wk),
      ed = new Date(s);
    ed.setDate(ed.getDate() + 7);
    var e = ed.getTime(),
      ps = wkStart(wk - 1);
    var per = [0, 0, 0, 0, 0, 0, 0],
      cs = {},
      tot = 0,
      prev = 0;
    items.forEach(function (i) {
      i.log.forEach(function (t) {
        if (t >= s && t < e) {
          per[(new Date(t).getDay() + 6) % 7]++;
          tot++;
          var c = i.cat || "No category";
          cs[c] = (cs[c] || 0) + 1;
        } else if (t >= ps && t < s) prev++;
      });
    });
    var mx = Math.max(3, Math.max.apply(null, per)),
      NM = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"],
      ti = (new Date().getDay() + 6) % 7,
      best = 0,
      d = tot - prev;
    per.forEach(function (v, i) {
      if (v > per[best]) best = i;
    });
    var a = new Date(s),
      b = new Date(s);
    b.setDate(b.getDate() + 6);
    var rg = { day: "numeric", month: "short" },
      title =
        wk === 0
          ? "This week"
          : wk === -1
            ? "Last week"
            : a.toLocaleDateString([], rg) +
              " – " +
              b.toLocaleDateString([], rg);
    var h =
      '<div class="wk"><button class="sm" data-a="pw" aria-label="Previous week">‹</button><div style="text-align:center"><b>' +
      title +
      '</b><div class="m">' +
      a.toLocaleDateString([], rg) +
      " – " +
      b.toLocaleDateString([], rg) +
      '</div></div><button class="sm" data-a="nw" aria-label="Next week"' +
      (wk >= 0 ? " disabled" : "") +
      ">›</button></div>";
    h +=
      '<div class="stats"><div class="card"><b>' +
      tot +
      '</b><span class="m">done this week</span></div><div class="card"><b>' +
      (tot ? NM[best] : "–") +
      '</b><span class="m">best day</span></div><div class="card"><b>' +
      (d > 0 ? "+" : "") +
      d +
      '</b><span class="m">vs last week</span></div></div>';
    var svg =
      '<svg class="chart" viewBox="0 0 304 140" role="img" aria-label="Reminders completed per day">';
    per.forEach(function (v, i) {
      var x = 8 + i * 42,
        hh = v ? (v / mx) * 92 : 3,
        y = 106 - hh,
        cur = wk === 0 && i === ti;
      svg +=
        '<rect class="bb' +
        (v ? "" : " bz") +
        (cur || (wk !== 0 && v) ? " t" : "") +
        '" x="' +
        x +
        '" y="' +
        y.toFixed(1) +
        '" width="30" height="' +
        hh.toFixed(1) +
        '" rx="7"/>';
      if (v)
        svg +=
          '<text class="cv" x="' +
          (x + 15) +
          '" y="' +
          (y - 5).toFixed(1) +
          '">' +
          v +
          "</text>";
      svg +=
        '<text class="cl' +
        (cur ? " t" : "") +
        '" x="' +
        (x + 15) +
        '" y="128">' +
        NM[i] +
        "</text>";
    });
    h += '<h2>Completed per day</h2><div class="card">' + svg + "</svg></div>";
    var ck = Object.keys(cs).sort(function (x, y) {
      return cs[y] - cs[x];
    });
    h +=
      '<h2>By category</h2><div class="card">' +
      (ck
        .map(function (c) {
          return (
            '<div class="crow"><span class="nm">' +
            esc(c) +
            '</span><span class="tr"><i style="width:' +
            (cs[c] / cs[ck[0]]) * 100 +
            "%;background:" +
            (c === "No category"
              ? "var(--accent)"
              : "hsl(" + hue(c) + ",55%,50%)") +
            '"></i></span><b class="ct">' +
            cs[c] +
            "</b></div>"
          );
        })
        .join("") || '<div class="m">Nothing completed this week yet.</div>') +
      "</div>";
    var gs = items.filter(function (i) {
      return i.goalN && i.goalPer === "week";
    });
    if (gs.length)
      h +=
        '<h2>Weekly goals</h2><div class="card">' +
        gs
          .map(function (i) {
            var c = i.log.filter(function (t) {
              return t >= s && t < e;
            }).length;
            return (
              '<div class="crow" style="display:block"><div class="t">' +
              esc(i.title) +
              ' <span class="m">' +
              c +
              " of " +
              i.goalN +
              (c >= i.goalN ? " ✓" : "") +
              '</span></div><div class="bar"><i style="width:' +
              Math.min(100, (c / i.goalN) * 100) +
              '%"></i></div></div>'
            );
          })
          .join("") +
        "</div>";
    return h;
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
    if (!$("sheet").classList.contains("on") && tab !== "more") render();
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
      '<div class="card item' +
      (over ? " late" : "") +
      '" style="--c:' +
      (it.cat ? "hsl(" + hue(it.cat) + ",55%,50%)" : "var(--line)") +
      '"><button class="chk" data-a="done" data-id="' +
      it.id +
      '" aria-label="Mark done"><svg viewBox="0 0 24 24"><path d="M5 12.5l4.5 4.5L19 7.5"/></svg></button><div class="mn">';
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
      h = hero(
        dn,
        act.filter(function (i) {
          var e = new Date();
          e.setHours(23, 59, 59, 999);
          return i.due <= e.getTime();
        }).length,
      );
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
          '<div class="empty"><span class="big">🌿</span>All clear for today.</div>');
      h +=
        "<h2>Upcoming</h2>" +
        (b.map(card).join("") ||
          '<div class="empty"><span class="big">✨</span>Nothing upcoming. Tap + to add one.</div>');
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
        review() +
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
        '<h2>Sound</h2><div class="card"><div class="m" style="margin-bottom:10px">Plays when a reminder is due while the app is open. Tap one to hear it.</div><div class="snds">' +
        Object.keys(SND)
          .concat(["silent"])
          .concat(prefs.custom ? ["custom"] : [])
          .map(function (k) {
            return (
              '<button data-snd="' +
              k +
              '" class="' +
              (prefs.sound === k ? "on" : "") +
              '">' +
              (k === "silent"
                ? "Silent"
                : k === "custom"
                  ? "My file"
                  : SND[k].n) +
              "</button>"
            );
          })
          .join("") +
        '</div><div style="margin-top:12px"><label for="vol">Volume</label><input id="vol" type="range" min="0.1" max="1" step="0.05" value="' +
        prefs.vol +
        '"></div><label class="chkrow" style="margin-top:12px;font-size:14px;color:var(--ink)"><input type="checkbox" id="vib"' +
        (prefs.vib ? " checked" : "") +
        '> Vibrate</label><div class="row" style="margin-top:12px"><button id="upl">Upload my own sound</button></div><div class="m" style="margin-top:8px">When the app is closed, the phone plays its own notification sound. That is set in your phone’s settings, not by websites.</div></div>';
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
    var sb = e.target.closest("[data-snd]");
    if (sb) {
      prefs.sound = sb.dataset.snd;
      savePrefs();
      playSound();
      render();
      return;
    }
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
      } else if (a === "pw") {
        wk--;
        anim = true;
        render();
      } else if (a === "nw" && wk < 0) {
        wk++;
        anim = true;
        render();
      }
      return;
    }
    if (e.target.id === "exp") exportData();
    if (e.target.id === "upl") $("sfile").click();
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
  $("view").addEventListener("input", function (e) {
    if (e.target.id === "vol") prefs.vol = parseFloat(e.target.value) || 0.6;
  });
  $("view").addEventListener("change", function (e) {
    if (e.target.id === "vol") {
      savePrefs();
      playSound();
    }
    if (e.target.id === "vib") {
      prefs.vib = e.target.checked;
      savePrefs();
      if (prefs.vib)
        try {
          navigator.vibrate && navigator.vibrate(60);
        } catch (x) {}
    }
  });
  $("sfile").addEventListener("change", function () {
    var f = $("sfile").files[0];
    if (!f) return;
    if (f.type && f.type.indexOf("audio") !== 0) {
      toast("Please pick an audio file.");
      $("sfile").value = "";
      return;
    }
    if (f.size > 700000) {
      toast("That file is too big. Pick a sound under 700 KB.");
      $("sfile").value = "";
      return;
    }
    var r = new FileReader();
    r.onload = function () {
      prefs.custom = r.result;
      prefs.sound = "custom";
      savePrefs();
      playSound();
      render();
      $("sfile").value = "";
    };
    r.onerror = function () {
      toast("Couldn’t read that file.");
    };
    r.readAsDataURL(f);
  });
  document.addEventListener(
    "pointerdown",
    function () {
      try {
        ac = ac || new (window.AudioContext || window.webkitAudioContext)();
        if (ac.state === "suspended") ac.resume();
      } catch (e) {}
    },
    { once: true },
  );
  loadPrefs();
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
