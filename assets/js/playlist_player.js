class PlaylistPlayerData {
  constructor(plid) {
    this.loop_all = false;
    this.shuffle = false;
    this.tracks = [];
    this.played_tracks = [];
    this.trackIndex = 0;
    this.playlistStartIndex = 0;
    this.playlistEndIndex = 0;
    this.playlistUrl = "";
    this.innerHtml = "";
    this.playlistId = plid;
    this.wasLoadedBefore = false;
  }
  readFromLocalStorage() {
    let playerData = helpers.storage.get("playlistPlayerData");
    if (playerData == null || playerData == undefined) return this;
    playerData = playerData[this.playlistId];
    this.loop_all = playerData.loop_current;
    this.shuffle = true;
    this.tracks = playerData.tracks;
    this.played_tracks = playerData.played_tracks;
    this.playlistStartIndex = playerData.playlistStartIndex;
    this.playlistEndIndex = playerData.playlistEndIndex;
    this.playlistUrl = playerData.playlistUrl;
    this.innerHtml = playerData.innerHtml;
    this.playlistId = playerData.playlistId;
    this.wasLoadedBefore = true;
    return this;
  }
  toLocalStorage() {
    this.playlistStartIndex = this.trackIndex;
    var saves = {};
    saves[this.playlistId] = this;
    helpers.storage.set("playlistPlayerData", saves);
  }
  getCurrentIndex() {
    return this.trackIndex;
  }
  getCurrentTrack() {
    return this.tracks[this.trackIndex];
  }
  nextTrack() {
    if (this.tracks.length > this.trackIndex + 1) {
        this.played_tracks.push(this.tracks.slice(this.trackIndex, 1));
        if (this.shuffle)
          this.trackIndex = Math.floor(Math.random() * this.tracks.length);
        else this.trackIndex += 1;
    } else {
        this.tracks = this.played_tracks;
        this.played_tracks = [];
        if (this.loop_all && this.trackIndex == this.tracks.length - 1){
            this.trackIndex = 0;
            return 0;
        }else{
            return undefined;
        }
    }
    return this.trackIndex;
  }
  addTrack(track) {
    this.tracks.push(track);
    this.playlistEndIndex += 1;
  }
  setPlaylistUrl(url) {
    this.playlistUrl = url;
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
  }
  setInnerHtml(innerHtml) {
    this.innerHtml = innerHtml;
  }
  setOffset() {
    document.getElementsByClassName(
        "pure-menu pure-menu-scrollable playlist-restricted"
      )[0].scrollTop = document.getElementById(this.getCurrentTrack()).offsetTop;
  }
  setPlaylistId(playlistId) {
    this.playlistId = playlistId;
  }
  wasLoaded() {
    return this.wasLoadedBefore;
  }
  setPlayingIndex(index) {
    this.playlistStartIndex = index;
    this.trackIndex = index;
    this.playlistEndIndex = this.tracks.length - 1;
  }
  toggle(mode){
    if (mode === "shuffle") this.shuffle = !this.shuffle;
    if (mode === "loop") this.loop_all = !this.loop_all;
    else throw new Error("Unknown mode: " + mode);
  }
}
class PlaylistPlayer {
  constructor(video_Data, plid) {
    this.videoData = video_Data;
    this.playerData = new PlaylistPlayerData(plid).readFromLocalStorage();
    this.playerData.setPlayingIndex(this.videoData.index);
    this.playlistNode = document.getElementById("playlist");
    this.playlistNode.innerHTML = spinnerHTMLwithHR;
    this.plid = plid;
  }
  loadDataAndSetUpOnPlayerEnded() {
    var context = this;
    if (this.playerData.wasLoaded()) {
      this.playlistNode.innerHTML = this.playerData.innerHtml;
      this.playerData.setOffset();
      this.playerData.toLocalStorage();
      player.on("ended", function () {
        context.next();
      });
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
          playerData.setInnerHtml(response.playlistHtml);
          playerData.parseResponse(response.playlistHtml);
          playerData.toLocalStorage();
          playlist.innerHTML = response.playlistHtml;
          playerData.setOffset();
          player.on("ended", function () {
            context.next();
          });
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
  buildUrl(video_id, index) {
    var url = new URL("https://example.com/watch?v=" + video_id);

    url.searchParams.set("list", this.plid);
    if (!this.playerData.playlistId.startsWith("RD"))
      url.searchParams.set("index", index);
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
    let video_id = this.playerData.tracks[index];
    this.playerData.setOffset();
    this.playerData.toLocalStorage();
    let url = this.buildUrl(video_id, index);
    location.assign(url.pathname + url.search);
  }
  toggleShuffle() {
    this.playerData.shuffle = !  this.playerData.shuffle;
  }
  toggleLoop() {
    this.playerData.loop = !this.playerData.loop;
  }
}
