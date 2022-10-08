class Track {
  private title: string = "";
  private played: boolean = false;
  private id: string = "";
  private channelName: string = "";
  private duration: string = "";
  private queryParameters: Map<string,string> = new Map(); // URL params

  constructor(id: string) {
    this.id = id;
  }
  /**
   * Static method that creates a track from the related div element
   * @param div Related video div
   * @returns Track
   */
  static FromDivElement(div: HTMLDivElement, id: string): Track {
    let track = new Track(id);
    track.title = (
      div.childNodes[1].childNodes[3] as HTMLParagraphElement
    ).innerText;
    track.channelName = (
      div.childNodes[3].childNodes[1] as HTMLDivElement
    ).innerText;
    track.duration = (
      div.childNodes[1].childNodes[1] as HTMLDivElement
    ).innerText;
    return track;
  }
  /**
   * Static method that creates a track object from the video_data object and the DOM
   * @param video_data window.video_data but this function does not assumes it so it needs to be passed.
   * @returns Track
   */
   static fromVideoData(video_data: Record<string, any>): Track {
    let track = new Track(video_data.id);
    track.title = document
      .getElementById("contents")!
      .getElementsByTagName("h1")[0].innerText;
    track.duration = (video_data.length_seconds / 60)
      .toPrecision(3)
      .replace(".", ":");
    track.channelName = document.getElementById("channel-name")!.innerText;
    return track
   }
  /**
   * Creates an html childNode from a track.
   * @returns A childNode that can be used.
   */
  toHtml(): ChildNode {
    return new DOMParser().parseFromString(
      '<li class="pure-menu-item" id="' +
        this.id +
        '"><a href="/watch?v=' +
        this.id +
        "&" +
        this.queryParamsIntoString() +
        '"><div class="thumbnail"><img loading="lazy" class="thumbnail" src="https://static.xamh.de/vi/' +
        this.id +
        '/mqdefault.jpg"><p class="length">' +
        this.duration +
        '</p></div><p style="width:100%">' +
        this.title +
        '</p><p><b style="width:100%">' +
        this.channelName +
        "</b></p></a></li>",
      "text/html"
    ).body.childNodes[0];
  }
  /**
   * Creates the html to represent a track but does not parses it.
   * @returns Non parsed html
   */
  toHtmlString(): string {
    return (
      '<li class="pure-menu-item" id="' +
      this.id +
      '"><a href="/watch?v=' +
      this.id +        
      "&" +
      this.queryParamsIntoString() +
      '"><div class="thumbnail"><img loading="lazy" class="thumbnail" src="https://static.xamh.de/vi/' +
      this.id +
      '/mqdefault.jpg"><p class="length">' +
      this.duration +
      '</p></div><p style="width:100%">' +
      this.title +
      '</p><p><b style="width:100%">' +
      this.channelName +
      "</b></p></a></li>"
    );
  }
  /**
   * Sets or updates the queryParameters map of a track.
   * @param name Name of the query parameter e.g listen
   * @param value The value of the  query parameter e.g 0
   */
  addOrUpdateQueryParam(name: string, value: string){
    this.queryParameters.set(name, value)
  }
  /**
   * Getter for track.title
   * @returns string
   */
  getTitle(): string{
    return this.title;
  }
  /**
   * Getter for track.channelName
   * @returns string
   */
  getAuthor(): string{
    return this.channelName;
  }
  /**
   * Getter for track.played aka was this track played
   * @returns boolean
   */
  getPlayed(): boolean{
    return this.played;
  }
  /**
   * Getter for track.id aka the video ID
   * @returns string
   */
  getTrackID(): string{
    return this.id;
  }
    /**
   * Getter for track.duration in minutes
   * @returns string
   */
  getDuration(): string{
    return this.duration;
  }
  /**
   * Getter for track.queryParameters 
   * @returns Map<string,string>
   */
  getQueryParams(): Map<string,string>{
    return this.queryParameters;
  }
  /**
   * Creates a string from the queryParameters map.
   * @returns A string of values and key formatted int in as url params.
   */
  private queryParamsIntoString(): string{
    let str = "";
    this.queryParameters.forEach((v, k) => str += v+"="+k+"&")
    return str;
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
  private playlistNode: PlaylistNode;

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
      let i = 0;
      // This reads weird but essentially its false by default so we check against it.
      while (this.tracks[trackIndex].played && !(i > this.tracks.length)) {
        trackIndex = Math.floor(Math.random() * this.tracks.length - 1);
        i++;
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

  // Setting the InnerHtml cause the the html to be reparsed. Use with caution as its expensive.
  setInnerHtml(innerHtml: string) {
    this.innerHtml = innerHtml;
    this.parseResponse(innerHtml);
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
    if (this.tracks.length == 0) return 0;
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
  reverse() {
    this.tracks.reverse();
    this.playlistNode.reverse();
  }
}
class PlaylistNode {
  private element!: HTMLOListElement;
  private templatePlaylistString: string =
    '<div><label for="loop">Loop Playlist</label><input name="loop" id="loop" type="checkbox"><label for="shuffle">Shuffle Playlist</label><input name="shuffle" id="shuffle" type="checkbox"><div id="playlist" class="h-box"><h3><a href="/feed/playlists">Current Playlist</a></h3><div class="pure-menu pure-menu-scrollable playlist-restricted"><ol class="pure-menu-list"></ol></div><hr></div></div>';
  private offsets: Record<string, number> = {};
  constructor() {
    this.getOrCreateDivElement();
  }
  /**
   * !!!!NOT YET IMPLEMENTED!!!! Sorts the HTML nodes NOT the tracks.
   * @param desc Wether to sort Descading, if false than Ascading is used.
   */
  sort(desc: boolean = false) {
    // TODO IMPLEMENT: MUST SORT BOTH TRACKS ARRAY AND HTML
  }
  /**
   * Reverses the HTML nodes NOT the tracks!
   */
  reverse() {
    for (let i = 0; i < this.element.childNodes.length - 1; i++) {
      this.element.insertBefore(
        this.element.childNodes[i],
        this.element.firstChild
      );
    }
  }
  /**
   * Adds/inserts a track at the given position and adds the offset to the offest map.
   * @param index Where to insert, variants are: "beforebegin" | "afterbegin" | "beforeend" | "afterend"
   * @param track Track to insert
   * @returns True if Successful. False if something failed.
   */
  insertAt(index: InsertPosition, track: Track): boolean {
    try {
      this.element.insertAdjacentHTML(index, track.toHtmlString());
      this.addOffset(track);
      return true;
    } catch (error) {
      return false;
    }
  }
  /**
   * Gets the offset for the given track.
   * @param offsetTrackId The track you want the offset for
   * @returns The offset or 0 if the id wasn't in the map
   */
  getOffset(offsetTrackId: string): number {
    try {
      return this.offsets[offsetTrackId];
    } catch {
      return 0
    }
  }
  /**
   * Sets the offset of a given track ID, it compares it to the current video ID 
   * if they don't match the video ID's offset is used.
   * If no given offset is useable, 0 is taken as the offset.
   * @param offsetTrackId Current track ID
   */
  setOffsetToGivenTrack(offsetTrackId: string) {
    let offset;
    try {      
      let expectedTrackId = new URLSearchParams(window.location.search).get("v")!;
      if (offsetTrackId == expectedTrackId) offset = this.offsets[offsetTrackId];
      else offset = this.offsets[expectedTrackId];
    } catch (error) {
      offset = 0;
    }
    this.element.parentElement!.scrollTop = offset;
  }
  /**
   * Sets Innerhtml while parsesing tracks from it and generating offsets.
   * @param innerHTML The string returned by the invidious api.
   * @returns Array<Track> if Successful. undefiened if something failed.
   */
  setINNERHTML(innerHTML: string): Array<Track> | boolean{
    this.element.innerHTML = innerHTML;
    try{
      return this.parseResponse(innerHTML);
    }catch{
      return false
    }
  }
  /** 
   * Either takes the element by id 'playlist' or creates it and inserts it into DOM.
   * This is called by the ctor of this class
   * @function private 
   */
  private getOrCreateDivElement() {
    const _element = document.getElementById("playlist");
    // IF null we wanna add controls
    if (_element == null) {
      // Shouldn't be null
      const div: HTMLElement = document.getElementById("related-videos")!;
      const playlistDiv = new DOMParser().parseFromString(
        this.templatePlaylistString,
        "text/html"
      );
      div.insertBefore(
        playlistDiv.body.childNodes[0],
        div.childNodes[0].nextSibling
      );
      // Can't be null Note that we already have a title and ordered list
      this.element = document
        .getElementById("playlist")!
        .getElementsByClassName("pure-menu-list")[0] as HTMLOListElement;
    } else {
      this.element = _element.getElementsByClassName(
        "pure-menu-list"
      )[0] as HTMLOListElement;
    }
  }
  /**
   * Adds offset for a given track, after it was inserted into the DOM.
   * @function private 
   * @param track The track to add the offset for.
   */
  private addOffset(track: Track) {
    this.offsets[track.id] = document.getElementById(track.id)!.offsetTop;
  }
  /**
   * Generates the offsets for all tracks in the playlist DIV
   * @function private 
   */
  private generateOffsets() {
    for (let i = 1; i < this.element.childNodes.length - 1; i += 2) {
      let element = this.element.childNodes[i];
      this.offsets[(element as Element).id] = document.getElementById(
        (element as Element).id
      )!.offsetTop;
    }
  }
  /**
   * Parses tracks out of the given HTML and generates offsets for them
   * @function private 
   * @param playlistHtml The HTML returned by the invidious API.
   * @returns Array<Track>
   */
  private parseResponse(playlistHtml: string): Array<Track> {
    let tracks: Array<Track> = [];
    var doc = new DOMParser().parseFromString(playlistHtml, "text/html");
    doc
      .getElementsByClassName("pure-menu-list")[0]
      .childNodes.forEach((node) => {
        let _node = node as Element;
        let title = "";
        if (_node.localName == "li" && _node.id != "") {
          try {
            title = (node.childNodes[1].childNodes[3] as Element).innerHTML;
          } catch (err) {
            title = (node.childNodes[0].childNodes[1] as Element).innerHTML;
          }
          if (title != "[Deleted video]") tracks.push(new Track(_node.id));
        }
      });
    this.generateOffsets();
    return tracks;
  }
}
class PlaylistManager {
  private videoData: Record<string, any>;
  private plid: string;
  private hasPlaylist: boolean;
  private playerData: PlaylistData;

  constructor(video_data: Record<string, any>) {
    this.videoData = video_data;
    const plid = new URLSearchParams(window.location.search).get("list");
    const plidCustom = new URLSearchParams(window.location.search).get(
      "listCustom"
    );
    this.hasPlaylist = true;
    if (plid === null && plidCustom != null) {
      document.getElementById("autoplay-controls")!.style.display = "none";
      this.plid = plidCustom;
      this.playerData = this.readFromLocalStorage();
      this.loadPlaylist();
    } else if (plidCustom === null && plid != null) {
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
      this.playerData.setPlayingIndex();
      this.toLocalStorage();
      return;
    }
    var plid_url;
    if (this.plid.startsWith("RD")) {
      plid_url =
        "https://api.xamh.de/api/v1/mixes/" +
        this.plid +
        "?continuation=" +
        this.videoData.id +
        "&format=html&hl=" +
        this.videoData.preferences.locale;
    } else {
      // We want to always ask for index  0 so that we get the whole playlist^^
      plid_url =
        "https://api.xamh.de/api/v1/playlists/" +
        this.plid +
        "?index=0&continuation=" +
        this.videoData.id +
        "&format=html&hl=" +
        this.videoData.preferences.locale;
    }
    var playerData = this.playerData;
    var context = this;
    window.helpers.xhr(
      "GET",
      plid_url,
      { retries: 5, entity_name: "playlist" },
      {
        on200: function (response: Record<string, any>) {
          playerData.setInnerHtml(response.playlistHtml);
          playerData.setPlayingIndex();
          context.toLocalStorage();
        },
        onNon200: function (xhr: Record<string, any>) {
          document.getElementById("continue")!.style.display = "";
        },
        onError: function (xhr: Record<string, any>) {},
        onTimeout: function (xhr: Record<string, any>) {},
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
  private next() {
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
  next_video() {
    if (playlistManager.hasAPlaylistLoaded()) playlistManager.next();
    else {
      playlistManager.createPlaylistFrom(video_data.id);
      playlistManager.addVideo("rv%" + video_data.next_video);
      playlistManager.next();
    }
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
    const track = this.trackFromID(video_id, false);
    let trackHtml = track.toHtml(queryParams)[0];
    // We need to do this since the html structure is ever so slighty different because of href thats missing on custom ones
    try {
      this.playlistNode.childNodes[2].childNodes[1].appendChild(trackHtml);
    } catch (error) {
      this.playlistNode.childNodes[1].childNodes[0].appendChild(trackHtml);
    }
    this.playerData.setInnerHtml(this.playlistNode.innerHTML);
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
    const track = this.trackFromID(video_id, true);
    this.playerData.addTrack(track, false);
    this.playerData.setPlayNextIndexOverwrite(1);
    this.toLocalStorage();
  }
  private trackFromID(video_id: string, fromVideData: boolean): Track {
    let track = new Track(video_id);
    if (fromVideData) track.fromVideoData(video_data);
    // Cant be null! Because if this is null, alot broke in invidious since there would a related video without and id.
    else
      track.FromDivElement(
        document.getElementById("rv%" + video_id)! as HTMLDivElement
      );
    return track;
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
      player.on("ended", next_video);
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
  next_video = playlistManager.next_video;
  // Need to register it here too since continue_autoplay isnt called autmatically
  player.on("ended", () => {
    playlistManager.next_video();
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

// Control the flow of mediaSession metadata
function updateMediaSession() {
  // Only refresh if the video is loaded and playing
  //@ts-ignore
  if (!player || player.paused())
    return (navigator.mediaSession.playbackState = "paused");

  if ("mediaSession" in navigator) {
    // Parse video data
    const cTrack = new Track(video_data.id);
    cTrack.fromVideoData(video_data);

    // Set content metadata
    //@ts-ignore
    navigator.mediaSession.metadata = new MediaMetadata({
      title: player_data.title.trim(),
      // TODO: in the future, extract the actual 'artist' from music videos and use this, same for the `album` property!
      //@ts-ignore
      artist: cTrack.channelName.trim(),
      artwork: [
        // TODO: we should have multiple sized thumbnails for the Media display to choose from, this is not optimised
        // ... and will use excessive bandwidth on Mobile, where smaller images are suitable

        // Chrome.com docs: Notification artwork size in Chrome for Android is 512x512. For low-end devices, it is 256x256.
        { src: player_data.thumbnail, sizes: "1280x720", type: "image/jpg" },
      ],
    });

    // Update playback state
    //@ts-ignore
    if ("setPositionState" in navigator.mediaSession) {
      //@ts-ignore
      navigator.mediaSession.playbackState = "playing";
      //@ts-ignore
      navigator.mediaSession.setPositionState({
        duration: player.duration() || 0,
        playbackRate: player.playbackRate() || 1,
        position: player.currentTime() || 0,
      });
    }
  }
}

// Hook mediaSession controls into Invidious
if ("mediaSession" in navigator) {
  // Previous track
  //@ts-ignore
  navigator.mediaSession.setActionHandler("previoustrack", () => {
    playlistManager.prev.call(window.playlistManager);
    updateMediaSession();
  });

  // Next track
  //@ts-ignore
  navigator.mediaSession.setActionHandler("nexttrack", () => {
    next_video();
    updateMediaSession();
  });

  // Skip forwards
  //@ts-ignore
  navigator.mediaSession.setActionHandler("seekforward", () => {
    skip_seconds(5 * player.playbackRate());
    updateMediaSession();
  });

  // Skip backwards
  //@ts-ignore
  navigator.mediaSession.setActionHandler("seekbackward", () => {
    skip_seconds(-5 * player.playbackRate());
    updateMediaSession();
  });

  // Note: we allow videojs to handle play/pause/stop action handles

  // Attempt to refresh media data every second
  setInterval(updateMediaSession, 1000);
}
