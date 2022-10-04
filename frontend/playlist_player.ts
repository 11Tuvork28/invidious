class Track {
  public title: string = "";
  public played: boolean = false;
  public id: string = "";
  private channelName: string = "";
  private duration: string = "";

  constructor(id: string) {
    this.id = id;
  }
  FromDivElement(div: HTMLDivElement): Track {
    this.title = (
      div.childNodes[1].childNodes[3] as HTMLParagraphElement
    ).innerText;
    this.channelName = (
      div.childNodes[3].childNodes[1] as HTMLDivElement
    ).innerText;
    this.duration = (
      div.childNodes[1].childNodes[1] as HTMLDivElement
    ).innerText;
    return this;
  }
  fromVideoData(video_data: Record<string, any>){
    this.title = document.getElementById("contents")!.getElementsByTagName("h1")[0].innerText;
    this.duration = (video_data.length_seconds / 60).toPrecision(3).replace(".", ":");
    this.channelName = document.getElementById("channel-name")!.innerText
  }
  toHtml(urlParams: Array<string>): NodeListOf<ChildNode> {
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
    ).body.childNodes;
  }
}
class PlaylistData {
  private loop_all: boolean;
  private shuffle: boolean;
  private tracks: Array<Track>;
  private trackIndex: number;
  private innerHtml: string | undefined;
  private playlistId: string;
  private wasLoadedBefore: boolean;
  private offsets: Record<string, number>;
  private isCustom: boolean;
  private playedTrackIndecies: Array<number>;
  private playNextIndexOverwrite: number | undefined;

  constructor() {
    this.loop_all = false;
    this.shuffle = false;
    this.tracks = [];
    this.trackIndex = 0;
    this.innerHtml = undefined;
    this.playlistId = "";
    this.wasLoadedBefore = false;
    this.offsets = {};
    this.isCustom = false;
    this.playedTrackIndecies = [];
  }
  fromJson(playerData: PlaylistData): PlaylistData {
    this.loop_all = playerData.loop_all || false;
    this.shuffle = playerData.shuffle || false;
    this.tracks = playerData.tracks || [];
    this.trackIndex = playerData.trackIndex || 0;
    this.innerHtml = playerData.innerHtml || "";
    this.playlistId = playerData.playlistId || "";
    this.wasLoadedBefore = true;
    this.offsets = playerData.offsets || {};
    this.isCustom = playerData.isCustom || false;
    this.playedTrackIndecies = playerData.playedTrackIndecies || [];
    this.playNextIndexOverwrite =
      playerData.playNextIndexOverwrite || undefined;
    return this;
  }
  toJson(): PlaylistData {
    return this;
  }
  getCurrentIndex(): number {
    return this.trackIndex;
  }
  getCurrentTrack(): Track {
    return this.tracks[this.trackIndex];
  }
  nextTrack(): number | undefined {
    if (this.playNextIndexOverwrite != undefined) {
      let returnIndex = this.playNextIndexOverwrite;
      this.playNextIndexOverwrite = undefined;
      return returnIndex;
    }
    let trackIndex = 0;
    this.playedTrackIndecies.push(this.trackIndex);
    this.tracks[this.trackIndex].played = true;
    if (this.shuffle) {
      if (this.tracks.length - 1 == this.trackIndex) return undefined;
      else {
        let i = 0;
        // This reads weird but essentially its false by default so we check against it.
        while (this.tracks[trackIndex].played && !(i > this.tracks.length)) {
          trackIndex = Math.floor(Math.random() * this.tracks.length - 1);
          i++;
        }
      }
    } else if (this.loop_all && this.trackIndex == this.tracks.length - 1) {
      trackIndex = 0;
    } else if (this.tracks.length - 1 == this.trackIndex) return undefined;
    else trackIndex = this.trackIndex + 1;
    return trackIndex;
  }
  previous() {
    return this.playedTrackIndecies.pop();
  }
  addTrack(track: Track, playNext: boolean) {
    if (this.trackIndex >= this.tracks.length || !playNext)
      this.tracks.push(track);
    else this.tracks.splice(0, 0, track);
    this.addOffset(track);
  }
  private parseResponse(playlistHtml: string,fromAPI: boolean) {
    this.tracks = []; // Need to reset it here because else we cause duplicates
    var parser = new DOMParser();
    var doc = parser.parseFromString(playlistHtml, "text/html");
    doc
      .getElementsByClassName("pure-menu-list")[0]
      .childNodes.forEach((node) => {
        let title: string = "";
        if (
          (node as Element).localName == "li" &&
          (node as Element).id != ""
        ) {
          if(fromAPI) title = (node.childNodes[1].childNodes[3] as Element).innerHTML;
          else title = (node.childNodes[0].childNodes[1] as Element).innerHTML;
          if(title != "[Deleted video]")
            this.tracks.push(new Track((node as Element).id));
        }
      });
    this.generateOffsets();
  }
  // Setting the InnerHtml cause the the html to be reparsed. Use with caution as its expensive.
  setInnerHtml(innerHtml: string, fromAPI: boolean) {
    this.innerHtml = innerHtml;
    this.parseResponse(innerHtml,fromAPI);
  }
  private generateOffsets() {
    this.tracks.forEach((track) => {
      this.offsets[track.id] = document.getElementById(track.id)!.offsetTop;
    });
  }
  private addOffset(track: Track) {
    this.offsets[track.id] = document.getElementById(track.id)!.offsetTop;
  }
  private setOffset() {
    let offset;
    let offsetTrackId = this.getCurrentTrack();
    let expectedTrackId = new URLSearchParams(window.location.search).get("v")!;
    if (offsetTrackId.id == expectedTrackId)
      offset = this.offsets[offsetTrackId.id];
    else offset = this.offsets[expectedTrackId];
    document.getElementsByClassName(
      "pure-menu pure-menu-scrollable playlist-restricted"
    )[0].scrollTop = offset;
  }
  wasLoaded(): boolean {
    return this.wasLoadedBefore;
  }
  setPlayingIndex() {
    // We try to get index from the tracks array since sometimes we get the video ID not index IDK.
    const nRawIndex = parseInt(
      this.isCustom == true
        ? new URLSearchParams(window.location.search).get("indexCustom")!
        : new URLSearchParams(window.location.search).get("index")!
    );
    const vId = new URLSearchParams(window.location.search).get("v")!;
    // Here rescue the index in case we got gibberish and fallback to getting the index of the video which is expensive.
    let index =
      Number.isNaN(nRawIndex) || nRawIndex > this.tracks.length - 1
        ? this.tracks.findIndex((track) => track.id == vId)
        : nRawIndex;
    if (index == -1) index = 0;
    this.trackIndex = index;
    // We need to set the offset anyway, since we don't call setOffset() directly from the player object.
    this.setOffset();
  }
  getInnerHTML() {
    return this.innerHtml;
  }
  // Already formated to be zero indexed (tracks.length -1)
  getTrackCount() {
    if(this.tracks.length == 0) return 0;
    return this.tracks.length - 1;
  }
  toggleShuffle() {
    this.shuffle = !this.shuffle;
  }
  toggleLoop() {
    this.loop_all = !this.loop_all;
  }
  getTrackByIndex(index: number): Track {
    return this.tracks[index];
  }
  isCustomPlaylist() {
    return this.isCustom;
  }
  setPlayNextIndexOverwrite(index: number) {
    if (index >= 0 && index < this.tracks.length) {
      this.playNextIndexOverwrite = index;
      this.trackIndex = index;
      this.setOffset();
    }
  }
}
class PlaylistManager {
  private videoData: Record<string, any>;
  private plid: string;
  private hasPlaylist: boolean;
  private playerData: PlaylistData;
  private playlistNode!: HTMLElement;

  constructor(video_data: Record<string, any>) {
    this.videoData = video_data;
    const plid = new URLSearchParams(window.location.search).get("list");
    const plidCustom = new URLSearchParams(window.location.search).get(
      "listCustom"
    );
    this.hasPlaylist = true;
    if (plid === null && plidCustom != null) {
      document.getElementById("autoplay-controls")!.style.display = "none";
      this.createPlaylistNode(true);
      this.plid = plidCustom;
      this.playerData = this.readFromLocalStorage();
      this.loadPlaylist();
    } else if (plidCustom === null && plid != null) {
      this.createPlaylistNode(false);
      this.plid = plid;
      this.playerData = this.readFromLocalStorage();
    } else {
      this.hasPlaylist = false;
      this.plid = "";
      this.playerData = new PlaylistData();
    }
  }
  loadPlaylist() {
    if (this.playerData.wasLoaded()) {
      // IF the playlist was loaded once before this IT must have INNERHTML.
      this.playlistNode.innerHTML = this.playerData.getInnerHTML()!;
      this.playerData.setPlayingIndex();
      this.toLocalStorage();
      return;
    }
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
      // We want to always ask for index  0 so that we get the whole playlist^^
      plid_url =
        "/api/v1/playlists/" +
        this.plid +
        "?index=0&continuation=" +
        this.videoData.id +
        "&format=html&hl=" +
        this.videoData.preferences.locale;
    }
    var playerData = this.playerData;
    var playlist = this.playlistNode;
    var context = this;
    window.helpers.xhr(
      "GET",
      plid_url,
      { retries: 5, entity_name: "playlist" },
      {
        on200: function (response: Record<string, any>) {
          playlist.innerHTML = response.playlistHtml;
          playerData.setInnerHtml(response.playlistHtml, true);
          playerData.setPlayingIndex();
          context.toLocalStorage();
        },
        onNon200: function (xhr: Record<string, any>) {
          playlist.innerHTML = "";
          document.getElementById("continue")!.style.display = "";
        },
        onError: function (xhr: Record<string, any>) {
          playlist.innerHTML = spinnerHTMLwithHR;
        },
        onTimeout: function (xhr: Record<string, any>) {
          playlist.innerHTML = spinnerHTMLwithHR;
        },
      }
    );
  }
  tryToLoadCustomPlaylist() {
    if (this.plid.length == 0) {
      const plid = window.helpers.storage.get("lastPlaylistID");
      if (plid != "customPlaylist") return; // We only want to do this on modified playlists
      const playerData: PlaylistData =
        window.helpers.storage.get("playlistPlayerData")[plid];
      if (playerData == undefined) return;
      this.hasPlaylist = true;
      this.plid = plid;
      document.getElementById("autoplay-controls")!.style.display = "none";
      this.createPlaylistNode(true);
      this.playerData = new PlaylistData().fromJson(playerData);
      this.playlistNode.innerHTML = this.playerData.getInnerHTML()!;
      this.playerData.setPlayingIndex();
      this.toLocalStorage();
    }
  }
  private buildUrl(video_id: string, index: number) {
    var url = new URL("https://example.com/watch?v=" + video_id);
    if (!this.playerData.isCustomPlaylist()) {
      url.searchParams.set("list", this.plid);
    } else {
      // Safe query param since its not used in the backend.
      url.searchParams.set("listCustom", this.plid);
    }
    // We always need the index regardless of what the backend thinks about it
    if (this.playerData.isCustomPlaylist())
      url.searchParams.set("indexCustom", index.toString());
    else url.searchParams.set("index", index.toString());
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
    if (index === undefined) {
      // Here we look if autoplay is enabled and if so we jump to next video while
      //adding it to playlist for convenience
      if (
        this.videoData.params.autoplay ||
        this.videoData.params.continue_autoplay
      ) {
        this.addVideo("rv%" + this.videoData.next_video); // Since its inserted at the last position we can just take the last index
        index = this.playerData.getTrackCount();
        this.toLocalStorage();
      } else return;
    }
    let track = this.playerData.getTrackByIndex(index);
    this.toLocalStorage();
    let url = this.buildUrl(track.id, index);
    location.assign(url.pathname + url.search);
  }
  prev() {
    let index = this.playerData.previous();
    if (index == undefined) return;
    let track = this.playerData.getTrackByIndex(index);
    this.toLocalStorage();
    let url = this.buildUrl(track.id, index);
    location.assign(url.pathname + url.search);
  }
  toggleShuffle() {
    this.playerData.toggleShuffle();
    this.toLocalStorage();
  }
  toggleLoop() {
    this.playerData.toggleLoop();
    this.toLocalStorage();
  }
  addVideo(video_id: string) {
    video_id = video_id.split("%")[1];
    if (!this.hasPlaylist) {
      return this.createPlaylistFrom(video_id);
    }
    const queryParams = [
      "listCustom=" + this.plid,
      this.playerData.isCustomPlaylist()
        ? "indexCustom=" + this.playerData.getTrackCount()
        : "index=" + this.playerData.getTrackCount(),
    ];
    const track = this.trackFromID(video_id,false);
    let trackHtml = track.toHtml(queryParams)[0];
    // We need to do this since the html structure is ever so slighty different because of href thats missing on custom ones
    try {
      this.playlistNode.childNodes[2].childNodes[1].appendChild(trackHtml);
    } catch (error) {
      this.playlistNode.childNodes[1].childNodes[0].appendChild(trackHtml);
    }
    this.playerData.setInnerHtml(this.playlistNode.innerHTML, false);
    this.playerData.setPlayingIndex();
    this.toLocalStorage();
  }
  hasAPlaylistLoaded() {
    return this.hasPlaylist;
  }
  createPlaylistFrom(video_id: string) {
    this.plid = "customPlaylist";
    this.playerData = this.readFromLocalStorage();
    this.hasPlaylist = true;
    this.createPlaylistNode(true);
    const queryParams = [
      "listCustom=" + this.plid,
      this.playerData.isCustomPlaylist()
        ? "indexCustom=" + this.playerData.getTrackCount()
        : "index=" + this.playerData.getTrackCount(),
    ];
    const track = this.trackFromID(video_id, true);
    const innerHTML =
      '<h3><a>Current Playlist</a></h3><div class="pure-menu pure-menu-scrollable playlist-restricted"><ol class="pure-menu-list"></ol></div><hr>';
    let parser = new DOMParser();
    let doc = parser.parseFromString(innerHTML, "text/html");
    doc.body.childNodes[1].childNodes[0].appendChild(
      track.toHtml(queryParams)[0]
    );
    this.playlistNode.innerHTML = doc.body.innerHTML;
    this.playerData.setInnerHtml(doc.body.innerHTML, false);
    this.playerData.setPlayNextIndexOverwrite(1);
    this.toLocalStorage();
  }
  private trackFromID(video_id: string, fromVideData: boolean): Track {
    let track = new Track(video_id);
    if(fromVideData)
      track.fromVideoData(video_data)
    else
    // Cant be null! Because if this is null, alot broke in invidious since there would a related video without and id.
    track.FromDivElement(
      document.getElementById("rv%" + video_id)! as HTMLDivElement
    );
    return track;
  }
  private createPlaylistNode(addControls: boolean) {
    if (addControls) {
      const div: HTMLElement = document.getElementById("related-videos")!;
      const playlistDiv = new DOMParser().parseFromString(
        '<div><label for="loop">Loop Playlist</label><input name="loop" id="loop" type="checkbox"><label for="shuffle">Shuffle Playlist</label><input name="shuffle" id="shuffle" type="checkbox"><div id="playlist" class="h-box"></div></div>',
        "text/html"
      );
      div.insertBefore(
        playlistDiv.body.childNodes[0],
        div.childNodes[0].nextSibling
      );
    }
    this.playlistNode = document.getElementById("playlist")!;
  }
  private toLocalStorage() {
    try {
      const playlists: Record<string, PlaylistData> =
        window.helpers.storage.get("playlistPlayerData");
      playlists[this.plid] = this.playerData.toJson();
      window.helpers.storage.set("playlistPlayerData", playlists);
      window.helpers.storage.set("lastPlaylistID", this.plid);
    } catch (error) {
      const saves: Record<string, PlaylistData> = {};
      saves[this.plid] = this.playerData.toJson();
      window.helpers.storage.set("playlistPlayerData", saves);
    }
  }
  private readFromLocalStorage() {
    try {
      const playerData: PlaylistData = window.helpers.storage.get(
        "playlistPlayerData"
      )[this.plid == "" ? "customPlaylist" : this.plid] as PlaylistData;
      return new PlaylistData().fromJson(playerData);
    } catch (error) {
      console.log("Playlist does not exist!");
      return new PlaylistData();
    }
  }
}

// HOOKS, we want to ts to ignore this so here we tell it to ignore it.

// Add event handlers to the buttons and it adds the buttons so that the use has a normal experince if no js
function addEventHandlersRelatedVideos() {
  let nodes = document.getElementById("related-videos")!.childNodes;
  nodes = nodes.item(nodes.length - 2).childNodes;
  nodes.forEach(function (element) {
    let _element: Element = element as Element;
    if (_element.nodeName == "DIV" && _element.id != "autoplay-controls") {
      const vidID = _element.id;
      let buttonNode = new DOMParser().parseFromString(
        '<button class="pure-button pure-button-primary">Add to current playlist.</button>',
        "text/html"
      ).body.childNodes[0];
      (buttonNode as HTMLButtonElement).onclick = function (event) {
        console.log("Added video: " + vidID);
        playlistManager.addVideo(vidID);
        (buttonNode as HTMLButtonElement).hidden = true;
      };
      _element.appendChild(buttonNode);
    }
  });
}
// We need to wait for everything to load so that we can safely override everything.
addEventListener("load", (ev) => {
  //@ts-ignore
  addEventHandlersRelatedVideos();
  //@ts-ignore
  continue_autoplay = function (event) {
    if (playlistManager.hasAPlaylistLoaded()) {
      player.on("ended", playlistManager.next);
    } else {
      if (event.target.checked) {
        player.on("ended", next_video);
      } else {
        player.off("ended");
      }
    }
  }; // override next video function

  // Overrides the function to get the playlist
  //@ts-ignore
  get_playlist = function (plid) {
    playlistManager.loadPlaylist();
  };

  // Overrides next video function, used to skip to next video.
  //@ts-ignore
  next_video = function () {
    if (playlistManager.hasAPlaylistLoaded()) playlistManager.next();
    else{
      playlistManager.createPlaylistFrom(video_data.id);
      playlistManager.addVideo("rv%"+video_data.next_video);
      playlistManager.next();
    }
  };
  // Need to register it here too since continue_autoplay isnt called autmatically
  player.on("ended", () => {
    if (playlistManager.hasAPlaylistLoaded()) playlistManager.next();
    else if (
      video_data.params.autoplay ||
      video_data.params.continue_autoplay
    ) {
      playlistManager.createPlaylistFrom(video_data.id);
      playlistManager.addVideo("rv%"+video_data.next_video);
    } else return;
  });
  // Hook to always load the custom playlist if one was created.
  //if (video_data.plid == undefined || video_data.plid == "")
    //playlistManager.tryToLoadCustomPlaylist();
});
var playlistManager = new PlaylistManager(video_data);
var shuffle_button = document.getElementById("shuffle");
if (shuffle_button) {
  //@ts-ignore
  shuffle_button.checked = playlistManager.playerData.shuffle;
  shuffle_button.addEventListener("click", function (event) {
    playlistManager.toggleShuffle();
  });
}
var loop_button = document.getElementById("loop");
if (loop_button) {
  //@ts-ignore
  loop_button.checked = playlistManager.playerData.loop_all;
  loop_button.addEventListener("click", function (event) {
    playlistManager.toggleLoop();
  });
}
