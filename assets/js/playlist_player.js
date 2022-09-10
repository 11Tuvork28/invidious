class PlaylistVideo {
  title;
  channelName;
  duration;
  id;
  constructor(array1, array2, id) {
    this.title = array1[2];
    this.channelName = array2[0];
    this.duration = array1[0];
    this.id = id;
  }
  toHtml(urlParams) {
    return new DOMParser().parseFromString(
      '<li class="pure-menu-item" id="' +
        this.id +
        '"><a href="/watch?v=' +
        this.id +
        "&" +
        urlParams.join("&") +
        '"><div class="thumbnail"><img loading="lazy" class="thumbnail" src="/vi/' +
        this.id +
        '/mqdefault.jpg"><p class="length">' +
        this.duration +
        '</p></div><p style="width:100%">' +
        this.title +
        '</p><p><b style="width:100%">' +
        this.channelName +
        "</b></p></a></li>",
      "text/html"
    );
  }
}
class PlaylistData {
  constructor(plid, isCustom) {
    this.loop_all = false;
    this.shuffle = false;
    this.tracks = [];
    this.played_tracks = [];
    this.trackIndex = 0;
    this.playlistStartIndex = 0;
    this.playlistEndIndex = 0;
    this.innerHtml = "";
    this.playlistId = plid;
    this.wasLoadedBefore = false;
    this.offsets = {};
    this.isCustom = isCustom;
    this.originalTrackCount = 0;
  }
  readFromLocalStorage() {
    try {
      let playerData =
        helpers.storage.get("playlistPlayerData")[this.playlistId];
      this.loop_all = playerData.loop_all;
      this.shuffle = playerData.shuffle;
      this.tracks = playerData.tracks;
      this.played_tracks = playerData.played_tracks;
      this.playlistStartIndex = playerData.playlistStartIndex;
      this.playlistEndIndex = playerData.playlistEndIndex;
      this.innerHtml = playerData.innerHtml;
      this.playlistId = playerData.playlistId;
      this.offsets = playerData.offsets;
      this.trackIndex = playerData.trackIndex;
      this.isCustom = playerData.isCustom;
      this.originalTrackCount = playerData.originalTrackCount;
      this.wasLoadedBefore = true;
      return this;
    } catch (error) {
      return this;
    }
  }
  toLocalStorage() {
    this.playlistStartIndex = this.trackIndex;
    try {
      let saves = helpers.storage.get("playlistPlayerData");
      saves[this.playlistId] = this;
      helpers.storage.set("playlistPlayerData", saves);
    } catch (error) {
      let saves = {};
      saves[this.playlistId] = this;
      helpers.storage.set("playlistPlayerData", saves);
    }
  }
  getCurrentIndex() {
    return this.trackIndex;
  }
  getCurrentTrack() {
    return this.tracks[this.trackIndex];
  }
  nextTrack() {
    if (this.shuffle)
      if (this.tracks.length == 0) return undefined;
      else {
        let playedTrack = this.tracks.splice(this.trackIndex, 1);
        if (playedTrack !== undefined || playedTrack !== null)
          this.played_tracks.push(playedTrack[0]);
        this.trackIndex = Math.floor(Math.random() * this.tracks.length-1);
        return this.originalTrackCount - this.trackIndex;
      }
    else if (this.loop_all && this.trackIndex == 0) {
      this.trackIndex = this.originalTrackCount;
      if (this.played_tracks.length - 1 == this.originalTrackCount)
        this.tracks = this.played_tracks;
      return 0;
    } else if (this.trackIndex == 0) return undefined;
    this.played_tracks.push(this.tracks.pop());
    this.trackIndex -= 1;
    return this.originalTrackCount - (this.tracks.length - 1);
  }
  addTrack(track, playNext) {
    if (this.trackIndex >= this.tracks.lengt || playNext) this.tracks.push(track);
    else this.tracks.splice(0, 0, track);
    this.playlistEndIndex += 1;
    this.originalTrackCount += 1;
  }
  parseResponse(playlistHtml) {
    var parser = new DOMParser();
    var doc = parser.parseFromString(playlistHtml, "text/html");
    doc
      .getElementsByClassName("pure-menu-list")[0]
      .childNodes.forEach((node) => {
        if (node.localName == "li" && node.id != "") {
          this.tracks.push(node.id);
        }
      });
    this.tracks.reverse();
    this.originalTrackCount = this.tracks.length -1;
    this.playlistEndIndex = this.tracks.length - 1;
    this.generateOffsets();
  }
  setInnerHtml(innerHtml) {
    this.innerHtml = innerHtml;
  }
  /** @private */
  generateOffsets() {
    this.tracks.forEach((track) => {
      this.offsets[track] = document.getElementById(track).offsetTop;
    });
  }
  addOffset(track) {
    this.offsets[track] = document.getElementById(track).offsetTop;
  }
  setOffset() {
    let offset;
    let offsetTrackId = this.getCurrentTrack();
    let expectedTrackId = new URLSearchParams(window.location.search).get("v");
    if (offsetTrackId == expectedTrackId) offset = this.offsets[offsetTrackId];
    else offset = this.offsets[expectedTrackId];
    document.getElementsByClassName(
      "pure-menu pure-menu-scrollable playlist-restricted"
    )[0].scrollTop = offset;
  }
  setPlaylistId(playlistId) {
    this.playlistId = playlistId;
  }
  wasLoaded() {
    return this.wasLoadedBefore;
  }
  setPlayingIndex() {
    // We try to get index from the tracks array since sometimes we get the video ID not index IDK.
    const nRawIndex = parseInt(
      this.isCustom == true
        ? new URLSearchParams(window.location.search).get("indexCustom")
        : new URLSearchParams(window.location.search).get("index")
    );
    // Here rescue the index in case we got gibberish.
    let index = Number.isNaN(nRawIndex) ? 0 : nRawIndex;
    // This should never happen.
    if (parseInt(index) > parseInt(this.originalTrackCount)) index = this.tracks.indexOf(new URLSearchParams(window.location.search).get('v'))
    this.trackIndex = this.originalTrackCount - index;
    // We need to set the offset anyway, since we don't call setOffset() directly from the player object.
    this.setOffset();
  }
}
class PlaylistManager {
  constructor(video_data) {
    this.videoData = video_data;
    const plid = new URLSearchParams(window.location.search).get("list");
    const plidCustom = new URLSearchParams(window.location.search).get(
      "listCustom"
    );
    if (plid === null && plidCustom != null) {
      this.hasPlaylist = true;
      document.getElementById("autoplay-controls").style.display = "none";
      this.createPlaylistNode();
      this.playerData = new PlaylistData(
        plidCustom,
        true
      ).readFromLocalStorage();
      this.plid = plidCustom;
      this.loadDataAndSetUpOnPlayerEnded();
    } else if (plidCustom === null && plid != null) {
      this.hasPlaylist = true;
      this.playerData = new PlaylistData(plid, false).readFromLocalStorage();
      this.plid = plid;
      this.playlistNode = document.getElementById("playlist");
      this.loadDataAndSetUpOnPlayerEnded();
    } else {
      this.hasPlaylist = false;
      this.playerData = new PlaylistData("", false);
    }
    player.on("ended", function () {
      console.log("Player ended");
      // global object Might be good to remove it from here.
      playlistManager.next();
    });
  }
  addPlaylist(plid) {
    this.playerData = new PlaylistData(plid, false).readFromLocalStorage();
    this.playlistNode = document.getElementById("playlist");
    this.playlistNode.innerHTML = spinnerHTMLwithHR;
    this.plid = plid;
  }
  loadDataAndSetUpOnPlayerEnded() {
    if (this.playerData.wasLoaded()) {
      this.playlistNode.innerHTML = this.playerData.innerHtml;
      this.playerData.setPlayingIndex();
      this.playerData.toLocalStorage();
      return;
    }
    this.playerData.setPlaylistId(this.plid);
    var plid_url;
    if (this.plid.startsWith("RD")) {
      plid_url =
        "/api/v1/mixes/" +
        this.plid +
        "?continuation=" +
        this.videoData.id +
        "&format=html&hl=" +
        this.videoData.preferences.locale;
    } else {
      plid_url =
        "/api/v1/playlists/" +
        this.plid +
        "?index=" +
        this.videoData.index +
        "&continuation=" +
        this.videoData.id +
        "&format=html&hl=" +
        this.videoData.preferences.locale +
        "&shuffle=" +
        this.videoData.params.always_shuffle_playlist;
    }
    var playerData = this.playerData;
    var playlist = this.playlistNode;
    helpers.xhr(
      "GET",
      plid_url,
      { retries: 5, entity_name: "playlist" },
      {
        on200: function (response) {
          playlist.innerHTML = response.playlistHtml;
          playerData.setInnerHtml(response.playlistHtml);
          playerData.parseResponse(response.playlistHtml);
          playerData.setPlayingIndex();
          playerData.toLocalStorage();
        },
        onNon200: function (xhr) {
          playlist.innerHTML = "";
          document.getElementById("continue").style.display = "";
        },
        onError: function (xhr) {
          playlist.innerHTML = spinnerHTMLwithHR;
        },
        onTimeout: function (xhr) {
          playlist.innerHTML = spinnerHTMLwithHR;
        },
      }
    );
  }
  /** @private */
  buildUrl(video_id, index) {
    var url = new URL("https://example.com/watch?v=" + video_id);
    if (!this.playerData.isCustom) {
      url.searchParams.set("list", this.plid);
    } else {
      // Safe query param since its not used in the backend.
      url.searchParams.set("listCustom", this.plid);
    }
    // We always need the index regardless of what the backend thinks about it
    if (this.playerData.isCustom) url.searchParams.set("indexCustom", index);
    else url.searchParams.set("index", index);
    if (
      this.videoData.params.autoplay ||
      this.videoData.params.continue_autoplay
    )
      url.searchParams.set("autoplay", "1");
    if (this.videoData.params.listen !== this.videoData.preferences.listen)
      url.searchParams.set("listen", this.videoData.params.listen);
    if (this.videoData.params.speed !== this.videoData.preferences.speed)
      url.searchParams.set("speed", this.videoData.params.speed);
    if (this.videoData.params.local !== this.videoData.preferences.local)
      url.searchParams.set("local", this.videoData.params.local);
    return url;
  }
  next() {
    let index = this.playerData.nextTrack();
    if (index === undefined) return;
    let video_id = this.playerData.tracks[this.playerData.trackIndex];
    this.playerData.toLocalStorage();
    let url = this.buildUrl(video_id, index);
    location.assign(url.pathname + url.search);
  }
  toggleShuffle() {
    this.playerData.shuffle = !this.playerData.shuffle;
    console.log("Shuffle: " + this.playerData.shuffle);
    this.playerData.toLocalStorage();
  }
  toggleLoop() {
    this.playerData.loop_all = !this.playerData.loop_all;
    console.log("Looping playlists: " + this.playerData.loop_all);
    this.playerData.toLocalStorage();
  }
  addVideo(video_id) {
    video_id = video_id.split("%")[1];
    if (!this.hasPlaylist) {
      this.plid = Date.now() + "-CustomPL";
      this.playerData = new PlaylistData(this.plid, true);
      this.hasPlaylist = true;
      this.createPlaylistNode();
    }
    let node = new PlaylistVideo(
      document
        .getElementById("rv%" + video_id)
        .children[0].outerText.split("\n"),
      document
        .getElementById("rv%" + video_id)
        .children[1].outerText.split("\n"),
      video_id
    );
    // If playNext is to be implemented, we need to return the index of the added track for later use.
    this.playerData.addTrack(video_id, false);
    // Static string
    let innerHTML = this.playerData.innerHtml;
    if (innerHTML === undefined || innerHTML === null || innerHTML === "")
      innerHTML =
        '<h3><a>Current Playlist</a></h3><div class="pure-menu pure-menu-scrollable playlist-restricted"><ol class="pure-menu-list"></ol></div><hr>';
    let parser = new DOMParser();
    let doc = parser.parseFromString(innerHTML, "text/html");
    const queryParams = [
      "listCustom=" + this.plid,
      this.playerData.isCustom
        ? "indexCustom=" + parseInt(this.playerData.tracks.length - 1)
        : "index=" + parseInt(this.playerData.tracks.length - 1),
    ];
    doc.body.childNodes[1].childNodes[0].appendChild(
      node.toHtml(queryParams).body.childNodes[0]
    );
    this.playlistNode.innerHTML = doc.body.innerHTML;
    this.playerData.setInnerHtml(doc.body.innerHTML);
    this.playerData.addOffset(video_id);
    if (!this.playerData.wasLoaded())
      this.playerData.parseResponse(doc.body.innerHTML);
    this.playerData.setPlayingIndex();
    this.playerData.toLocalStorage();
    this.playerData.wasLoadedBefore = true;
  }
  createPlaylistNode() {
    const div = document.getElementById("related-videos");
    const playlistDiv = new DOMParser().parseFromString(
      '<div><label for="loop">Loop Playlist</label><input name="loop" id="loop" type="checkbox"><label for="shuffle">Shuffle Playlist</label><input name="shuffle" id="shuffle" type="checkbox"><div id="playlist" class="h-box"></div></div>',
      "text/html"
    );
    div.insertBefore(
      playlistDiv.body.childNodes[0],
      div.childNodes[0].nextSibling
    );
    this.playlistNode = document.getElementById("playlist");
  }
}
