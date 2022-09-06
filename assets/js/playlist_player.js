class PlaylistPlayerData {
  constructor(plid) {
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
  }
  readFromLocalStorage() {
    let playerData = helpers.storage.get("playlistPlayerData");
    if (playerData == null || playerData == undefined) return this;
    playerData = playerData[this.playlistId];
    this.loop_all = playerData.loop_all;
    this.shuffle = playerData.shuffle;
    this.tracks = playerData.tracks;
    this.played_tracks = playerData.played_tracks;
    this.playlistStartIndex = playerData.playlistStartIndex;
    this.playlistEndIndex = playerData.playlistEndIndex;
    this.playlistUrl = playerData.playlistUrl;
    this.innerHtml = playerData.innerHtml;
    this.playlistId = playerData.playlistId;
    this.offsets = playerData.offsets;
    this.trackIndex = playerData.trackIndex;
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
        this.played_tracks.push(this.tracks.slice(this.trackIndex, 1)[0]);
        if (this.shuffle)
          this.trackIndex = Math.floor(Math.random() * this.tracks.length);
        else this.trackIndex += 1;
    } else {
      if (this.loop_all){
        this.trackIndex = 0;
        return 0;
        }else{
            return undefined;
        }
    }
    this.setOffset(this.getCurrentTrack())
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
  setOffset(){
    document.getElementsByClassName(
      "pure-menu pure-menu-scrollable playlist-restricted"
    )[0].scrollTop = this.offsets[this.getCurrentTrack()];
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
}
class PlaylistPlayer {
  constructor(video_Data, plid) {
    this.videoData = video_Data;
    this.playerData = new PlaylistPlayerData(plid).readFromLocalStorage();
    this.playlistNode = document.getElementById("playlist");
    this.playlistNode.innerHTML = spinnerHTMLwithHR;
    this.plid = plid;
  }
  loadDataAndSetUpOnPlayerEnded() {
    var context = this;
    if (this.playerData.wasLoaded()) {
      this.playlistNode.innerHTML = this.playerData.innerHtml;
      this.playerData.setPlayingIndex(this.videoData.index);
      this.playerData.setOffset();
      this.playerData.toLocalStorage();
      player.on("ended", function () {
        console.log("Player ended");
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
    var videoData = this.videoData;
    helpers.xhr(
      "GET",
      plid_url,
      { retries: 5, entity_name: "playlist" },
      {
        on200: function (response) {
          playlist.innerHTML = response.playlistHtml;
          playerData.setInnerHtml(response.playlistHtml);
          playerData.setPlayingIndex(videoData.index);
          playerData.parseResponse(response.playlistHtml);
          playerData.setOffset();
          playerData.toLocalStorage();
          player.on("ended", function () {
            console.log("Player ended");
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
    this.playerData.shuffle = !this.playerData.shuffle;
    console.log("Shuffle: " + this.playerData.shuffle);
    this.playerData.toLocalStorage();
  }
  toggleLoop() {
    this.playerData.loop_all = !this.playerData.loop_all;
    console.log("Looping playlists: " + this.playerData.loop_all);
    this.playerData.toLocalStorage();
  }
}