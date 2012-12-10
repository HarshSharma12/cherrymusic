//
// CherryMusic - a standalone music server
// Copyright (c) 2012 Tom Wallroth & Tilman Boerner
//
// Project page:
//   http://fomori.org/cherrymusic/
// Sources on github:
//   http://github.com/devsnd/cherrymusic/
//
// licensed under GNU GPL version 3 (or later)
//
// CherryMusic is based on
//   jPlayer (GPL/MIT license) http://www.jplayer.org/
//   CherryPy (BSD license) http://www.cherrypy.org/
//
// This program is free software: you can redistribute it and/or modify
// it under the terms of the GNU General Public License as published by
// the Free Software Foundation, either version 3 of the License, or
// (at your option) any later version.
//
// This program is distributed in the hope that it will be useful,
// but WITHOUT ANY WARRANTY; without even the implied warranty of
// MERCHANTABILITY or FITNESS FOR A PARTICULAR PURPOSE.  See the
// GNU General Public License for more details.
//
// You should have received a copy of the GNU General Public License
// along with this program.  If not, see <http://www.gnu.org/licenses/>
//
var playableExtensions = undefined;
var availableEncoders = undefined;
var availablejPlayerFormats = [];
var availableDecoders = undefined;
var transcodingEnabled = undefined;
var fetchAlbumArt = undefined;
var userOptions = undefined;
var REMEMBER_PLAYLIST_INTERVAL = 3000;
var HEARTBEAT_INTERVAL_MS = 30*1000;

var playlistSelector = '.jp-playlist';

var executeAfterConfigLoaded = []

function api(data_or_action, successfunc, errorfunc, background){
    "use strict";
    if(!successfunc){
        successfunc = function(){};
    }
    var completefunc;
    if(background){
        completefunc = function(){};
    } else {
        completefunc = function(){$('div#progressscreen').fadeOut('fast')};
    }
    var senddata;
    var apiaction;
    if(typeof data_or_action === "string"){
        apiaction = data_or_action;
        senddata = {};
    } else {
        apiaction = data_or_action['action'];
        senddata = {"value" :  data_or_action['value'] };
        
    }
    if(!errorfunc){
        errorfunc = function(){
            errorFunc('calling API function "'+apiaction+'"')();
            $('div#progressscreen').fadeOut('fast');
        }
    }
    if(!background){
        $('div#progressscreen').fadeIn('fast');
    }
    var urlaction = '/api';
    if(apiaction){
        urlaction += '/'+apiaction;
    }    
    $.ajax({      
        url: urlaction,
        context: $(this),
        type: 'POST',
        data: senddata,
        success: successfunc,
        error: errorfunc,
        complete: completefunc,
    });
}

function errorFunc(msg){
    "use strict";
    return function(){
        displayError(msg);
    };
}
function displayError(msg){
    $('#errormessage').html(msg);
}
function removeError(msg){
    if($('#errormessage').html() == msg){
        $('#errormessage').html('');
    }
}
/*******************
CONFIGURATION LOADER
*******************/
function loadConfig(){
    "use strict";
    var configoptions = ['getplayables','getencoders','getdecoders','transcodingenabled','fetchalbumart'];
    var data = {
        'action' : 'getconfiguration',
        'value' : JSON.stringify(configoptions),
    };
    var success = function(data){
        var dictatedClientConfig = jQuery.parseJSON(data);
        availableEncoders = dictatedClientConfig.getencoders;
        availableDecoders = dictatedClientConfig.getdecoders;
        playableExtensions = dictatedClientConfig.getplayables;
        transcodingEnabled = dictatedClientConfig.transcodingenabled;
        fetchAlbumArt = dictatedClientConfig.fetchalbumart;
        for(var i=0; i<executeAfterConfigLoaded.length; i++){
            executeAfterConfigLoaded[i]();
        }
    };
    var error = errorFunc("could not fetch client configuration");
    api(data,success,error,true);
}

/************
 * USER OPTIONS
 * **********/
 
function loadAndShowUserOptions(){
        var success = function(data){
            $('#useroptions .content').html('');
            $('#useroptions').fadeIn();
            optiondict = jQuery.parseJSON(data);
            new OptionRenderer('#useroptions .content').render(optiondict);
     }
     api('getuseroptions',success);
}

function OptionRenderer(cssselector){
    this.cssselector = cssselector;
    this.pretty = {
        'custom_theme' : 'Custom colors and style',
        'custom_theme.primary_color' : 'Primary color',
        'custom_theme.white_on_black' : 'Use white fonts on dark background',
        'keyboard_shortcuts' : 'keyboard shortcuts (not working yet)',
        'keyboard_shortcuts.stop' : 'Stop',
        'keyboard_shortcuts.prev' : 'previous track',
        'keyboard_shortcuts.search' : 'search',
        'keyboard_shortcuts.next' : 'next track',
        'keyboard_shortcuts.play' : 'play',
        'keyboard_shortcuts.pause' : 'pause',
        'use_old_gui' : 'use old GUI version',
    }
}
OptionRenderer.prototype = {
    render : function(optiondict){
        var self = this;
        $.each(optiondict, function(optionkey, optionval) {
            if(typeof self.pretty[optionkey] === 'undefined'){
                $(self.cssselector).append('<h2>'+optionkey+'</h2>');
            } else {
                $(self.cssselector).append('<h2>'+self.pretty[optionkey]+'</h2>');
            }
            self.renderOption(optionkey, optionval);
        });
    },
    renderOption : function(optionkey, optionval, prefix){
        var self = this;
        prefix = prefix || '';
        window.console.log("parsing value "+optionkey+':'+optionval);
        if(typeof optionval == 'boolean'){
            self.renderOptionField(prefix+optionkey, optionval);
        } else if(typeof optionval.value !== 'undefined'){
            self.renderOptionField(prefix+optionkey, optionval.value);
        } else {
            $.each(optionval, function(suboptionkey, suboptionval) {
                self.renderOption(suboptionkey, suboptionval, optionkey+'.');
            });
        }   
    },
    renderOptionField : function(optionkey, optionval){
        var self = this;
        if(typeof self.pretty[optionkey] === 'undefined'){
            var label = optionkey;
        } else {
            var label = self.pretty[optionkey];
        }

        var success = 'false'; //use default handlers
        var error = 'false';
        if(optionkey.indexOf('custom_theme') != -1){
            success = 'reloadStylesheets';
            error = 'function(){}';
        }
            
        switch(typeof optionval){
            case "string":
                var onkeyup = [   'api({action:\'setuseroption\', value:JSON.stringify({',
                    '\'optionkey\':$(this).attr(\'name\') ,',
                    '\'optionval\':$(this).val()',
                    '}) },'+success+','+error+')' ].join(" ");
                $('#useroptions .content').append(label+'<input onkeyup="'+onkeyup+'" name="'+optionkey+'" value="'+optionval+'"/><br>');
                break;
            case "boolean":
                var checked = optionval? 'checked="checked"' : '';
                var onchange = ['api({action:\'setuseroption\', value:JSON.stringify({',
                    '\'optionkey\':\''+optionkey+'\' ,',
                    '\'optionval\':$(this).attr(\'checked\')==\'checked\'',
                    '}) },'+success+','+error+')' ].join(" ");
                $('#useroptions .content').append(label+'<input '+checked+' onchange="'+onchange+'" type="checkbox" name="'+optionkey+'" value="true"></input><br>');
                break;
            default:
                window.console.log("unknown option value "+optionkey+':'+optionval);
        }
    },
}
function reloadStylesheets() {
    var queryString = '?reload=' + new Date().getTime();
    $('link[rel="stylesheet"]').each(function () {
        if(this.href.indexOf('api/customcss.css') != -1){
            this.href = this.href.replace(/\?.*|$/, queryString); 
        }
    });
}
/***
SEARCH
***/
function fastsearch(append){
    "use strict";
    var data = {
        'action' : 'fastsearch',
        'value' : $('#searchfield input').val()
    };
    var success = function(data){
        if(append){
            $('#searchresults').append(parseAndRender(data));
        } else {
            $('#searchresults').html(parseAndRender(data)); 
        }
        registerlistdirs($('#searchresults').find('ul'));
        registercompactlistdirs($('#searchresults').find('ul'));
        registermp3s($('#searchresults').find('ul'));
        //search(true);
        $('#searchresults').find('ul').append('<li class="slowsearch">loading more search results...</li>');
    };
    var error = function(){
        errorFunc('failed loading fast-search results')();
    };
    api(data,success,error);
    return false;
}
function search(append){
    "use strict";
    var data = {
        'action' : 'search',
        'value' : $('#searchfield input').val()
    };
    var success = function(data){
        if(append){
            $('#searchresults').append(parseAndRender(data));
        } else {
            $('#searchresults').html(parseAndRender(data));
        }
        registerlistdirs($('#searchresults').find('ul'));
        registercompactlistdirs($('#searchresults').find('ul'));
        registermp3s($('#searchresults').find('ul'),false);
        $('#searchresults').find('ul li.slowsearch').remove();
    };
    var error = function(){
        errorFunc('failed loading search results')();
    };
    api(data,success,error);
    return false;
}
function submitsearch(){
    //fastsearch();
    search();
    return false;
}

/********
RENDERING
********/
function parseAndRender(data){
    "use strict";
    return renderList(jQuery.parseJSON(data));
}
function renderList(l){
    "use strict";
    var html = "";
    $.each(l, function(i, e) { 
        switch(e.type){
            case 'file':
                html += listify(renderFile(e.label,e.urlpath,e.path),'class="fileinlist"');
                break;
            case 'dir':
                html += listify(renderDir(e.label,e.urlpath,e.path));
                break;
            case 'compact':
                html += listify(renderCompact(e.label,e.urlpath,e.label));
                break;
            default:
                errorFunc('server response is not valid!')();
                break;
        }
    });
    return ulistify(html);
}
function renderDir(label,urlpath,dirpath){
    "use strict";
    var rendereddir = '<a dir="'+dirpath+'" href="javascript:;" class="listdir">';
    if(fetchAlbumArt && dirpath.indexOf('/')>0){
        var searchterms = encodeURIComponent(JSON.stringify({'directory' : dirpath}))
        rendereddir += '<img src="/api/fetchalbumart/'+searchterms+'" width="80" height="80" />';
    }
    return rendereddir+dirpath+'</a>';
}
function renderFile(label,urlpath,dirpath){
    "use strict";
    var fullpathlabel = Mustache.render('<span class="fullpathlabel">{{fpdirpath}}</span>',{fpdirpath:dirpath});
    if(isPlayableAudioFile(urlpath)){
        return Mustache.render('<a title="{{atitle}}" href="{{ahref}}" class="{{acssclass}}" path="{{apath}}">{{{afullpathlabel}}} {{alabel}}</a>', {
                atitle : label,
                alabel: label,
                ahref : 'javascript:;',
                acssclass : 'mp3file',
                apath : urlpath,     
                afullpathlabel : fullpathlabel,            
            });//+'<a class="floatright" href="javascript:;">&uarr;DIR</a>';
    } else {
        return '<span>'+fullpathlabel+label+'</span>';
    }
}
function renderCompact(label,filepath, filter){
    "use strict";
    return '<a dir="'+filepath+'" filter="'+filter+'" href="javascript:;" class="compactlistdir">'+filter.toUpperCase()+'</a>';
}
function listify(html, classes){
    "use strict";
    if(!classes){classes='';}
    return '<li '+classes+'>'+html+'</li>';
}
function ulistify(html){
    "use strict";
    return '<ul>'+html+'</ul>';
}
function isPlayableAudioFile(filePath){
    "use strict";
    for(var i=0; i<playableExtensions.length; i++){
        if(endsWith( filePath.toUpperCase(),
                     playableExtensions[i].toUpperCase())){
            return true;
        }
    }
    return false;
}
/***
INTERACTION
***/
listdirclick = function(mode){
        "use strict";
        var directory = $(this).attr("dir");
        if($(this).siblings('ul').length>0){
            if($(this).siblings('ul').is(":visible")){
                $(this).siblings('ul').slideUp('slow');
            } else {
                $(this).siblings('ul').slideDown('slow');
            }
        } else {
            //$('div#progressscreen').fadeIn('fast');
            var data = {
                'action' : 'listdir',
                'value' : JSON.stringify({ 'directory' : directory })
            };
            var currdir = this;
            var success = function(data){
                $(currdir).parent().append(parseAndRender(data));
                registerlistdirs($(currdir).parent().find('ul'));
                registercompactlistdirs($(currdir).parent().find('ul'));
                registermp3s($(currdir).parent().find('ul'));
                $(currdir).siblings("ul").slideDown('slow');
            };
            api(data,success,errorFunc('unable to list directory'));
        }
};
compactlistdirclick = function(){
    "use strict";
    var directory = $(this).attr("dir");
    var filter = $(this).attr("filter");
    //alert(directory);
    if($(this).siblings('ul').length>0){
        if($(this).siblings('ul').is(":visible")){
            $(this).siblings('ul').slideUp('slow');
        } else {
            $(this).siblings('ul').slideDown('slow');
        }
    } else {
        var data = {
            'action' : 'compactlistdir',
            'value' : JSON.stringify({ 'directory' : directory,
                        'filter' : filter })
        };
        var currdir = this;
        var success = function(data){
            $(currdir).parent().append(parseAndRender(data));
            registerlistdirs($(currdir).parent().find('ul'));
            registercompactlistdirs($(currdir).parent().find('ul'));
            registermp3s($(currdir).parent().find('ul'));
            $(currdir).siblings("ul").slideDown('slow');
        };
        api(data,success,errorFunc('unable to list compact directory'));
    }

};
registerlistdirs = function(parent){ 
    "use strict";
    $(parent).find("a.listdir").click(
        listdirclick
    );
};

registercompactlistdirs = function(parent){
    "use strict";
    $(parent).find("a.compactlistdir").click(
        compactlistdirclick
    );
};

addAllToPlaylist = function(){
    "use strict";
    $(this).siblings('li').find('.mp3file').each(function(){
        playlistManager.addSong( $(this).attr("path"), $(this).attr("title") );
    });
    $(this).blur();
    return false;
};
addThisTrackToPlaylist = function(){
    playlistManager.addSong( $(this).attr("path"), $(this).attr("title") );
    $(this).blur();
    return false;
}

registermp3s = function(parent,mode){
    "use strict";
    if(typeof mode === 'undefined'){
        mode = 'addPlayAll'
    }
    var foundMp3 = $(parent).find(".mp3file").click(
        addThisTrackToPlaylist
    ).html();
    if(foundMp3){
        var editplaylist = playlistManager.getEditingPlaylist();
        switch(mode) {
            case 'loadPlaylist':
                $(parent).prepend('<a class="addAllToPlaylist" href="javascript:;">load playlist</a>');
                 break;
            case 'addPlayAll':
                var playlistname  = typeof editplaylist === 'undefined' ? 'new playlist' : editplaylist.name;
                $(parent).prepend('<a class="addAllToPlaylist" href="javascript:;">add all to <span class="plsmgr-editingplaylist-name">' + playlistname + '</span></a>');
                break;
            default:
                break;
        }
        $(parent).children('.addAllToPlaylist').click(
            addAllToPlaylist
        );
    }
};

updateLibrary = function(){
    api('updatedb')
}

/***
JPLAYER FUNCTIONS
***/
function setAvailableJPlayerFormats(){
    if(availableEncoders.length == 0){
        availablejPlayerFormats.push(ext2jPlayerFormat('mp3'));
    } else {
        for(var i=0; i<availableEncoders.length; i++){
            availablejPlayerFormats.push(ext2jPlayerFormat(availableEncoders[i]));
        }
    }
    sortFormatPreferrencePerBrowser();
}

function sortFormatPreferrencePerBrowser(){
    var browser = detectBrowser();
    //see http://www.w3schools.com/html/html5_audio.asp for available formats per browser
    if(['msie','safari'].indexOf(browser) != -1){
    //set preferred format for IE and safari to mp3
        if(availableEncoders.indexOf('mp3') != -1){
            //remove mp3
            availableEncoders = availableEncoders.filter(function(i){return i!='mp3'});
            //add mp3 as first playback format
            availableEncoders.unshift('mp3');
        }
    } else {
        //set to ogg for all te others
        if(availableEncoders.indexOf('ogg') != -1){
            //remove ogg
            availableEncoders = availableEncoders.filter(function(i){return i!='ogg'});
            //add ogg as first playback format
            availableEncoders.unshift('ogg');
        }
    }
}






/* PLAYLIST CREATION AND MANAGEMENT END*/

ext2jPlayerFormat = function(ext){
    switch(ext){
        case "mp3": return "mp3";
        
        case "ogg": 
        case "oga": return "oga";
        
        case "m4a": 
        case "mp4":
        case "aac": return "m4a";
        
        case "wav": return "wav";
        
        case "weba": return "webma";
    }
}


/**********
TRANSCODING
**********/

function getTranscodePath(filepath, format){
    "use strict";
    var match = filepath.match(/\/serve(.*)$/);
    if(match){
        return "/trans"+match[1]+"/get."+format;
    }        
}

/******************
PLAYLIST MANAGEMENT
******************/
function showPlaylistSaveDialog(plid){
    "use strict";
    $('#dialog').html(
    ['<p>Please enter a Name for this Playlist:</p>',
    '<input type="text" id="playlisttitle" />',
    'public:<input type="checkbox" checked="checked" id="playlistpublic" />',
    '<a class="button" href="javascript:;" onclick="savePlaylistAndHideDialog('+plid+')">Save</a>',
    '<a class="button" href="javascript:;" onclick="$(\'#dialog\').fadeOut(\'fast\')">Close</a>'].join(''));

    $('#dialog input').val('');
    $('#dialog').fadeIn('fast');
}

function savePlaylistAndHideDialog(plid){
    "use strict";
    var name = $('#playlisttitle').val();
    var pub = $('#playlistpublic').attr('checked')?true:false;
    if(name.trim() !== ''){
        savePlaylist(plid,name,pub);
        $('#dialog').fadeOut('fast');
    }
}

function savePlaylist(plid,playlistname,ispublic){
    "use strict";
    var data = { 'action':'saveplaylist',
                'value':JSON.stringify({
                            'playlist':playlistManager.getPlaylistById(plid).jplayerplaylist.playlist,
                            'public':ispublic,
                            'playlistname':playlistname
                        })
                };
    var success = function(){
        playlistManager.getPlaylistById(plid).name = playlistname;
        playlistManager.getPlaylistById(plid).public = ispublic;
        playlistManager.getPlaylistById(plid).saved = true;
        playlistManager.refresh();
        playlistManager.showPlaylist(plid);
    }
    api(data,success,errorFunc('error saving playlist'));
}
function getAddrPort(){
    m = (window.location+"").match(/https?:\/\/(.+?):?(\d+).*/);
    return 'http://'+m[1]+':'+m[2];
}

function ord(c)
{
  return c.charCodeAt(0);
}
function dec2Hex(dec){
    var hexChars = "0123456789ABCDEF";
    var a = dec % 16;
    var b = (dec - a)/16;
    hex = hexChars.charAt(b) + hexChars.charAt(a);
    return hex;
}

function userNameToColor(username){
    username = username.toUpperCase();
    username+='AAA';
    var g = ((ord(username[0])-65)*255)/30;
    var b = ((ord(username[1])-65)*255)/30;
    var r = ((ord(username[2])-65)*255)/30;
    return '#'+dec2Hex(r)+dec2Hex(g)+dec2Hex(b);
}

function showPlaylists(){
    "use strict";
    var success = function(data){
            var addressAndPort = getAddrPort();
            var pls = '<ul>';
            $.each($.parseJSON(data),function(i,e){
                pls += Mustache.render(
                    ['<li id="playlist{{playlistid}}">',
                    '<div class="remoteplaylist">',
                        '<div class="playlisttitle">',
                            '<a href="javascript:;" onclick="loadPlaylist({{playlistid}})">',
                            '{{playlistlabel}}',
                            '</a>',
                        '</div>',
                        '<div class="usernamelabel">',
                            '<span style="background-color: {{usernamelabelcolor}}" >{{username}}</span>',
                        '</div>',
            			'<div class="deletebutton">',
			            '<a href="javascript:;" class="button" onclick="confirmDeletePlaylist({{playlistid}})">x</a>',
            			'</div>',
                        '<div class="dlbutton">',
                            '<a class="exportPLS button" href="/api?action=downloadpls&value={{dlval}}">',
                            '&darr;&nbsp;PLS',
                            '</a>',
                        '</div>',
                        '<div class="dlbutton">',
                            '<a class="exportM3U button" href="/api?action=downloadm3u&value={{dlval}}">',
                            '&darr;&nbsp;M3U',
                            '</a>',
                        '</div>',
                    '</div>',
                    '<div class="playlistcontent">',
                    '</div>',
                    '</li>'].join(''),
                {
                playlistid:e['plid'],
                playlistlabel:e['title'],
                dlval : JSON.stringify({ 'plid' : e['plid'],
                    'addr' : addressAndPort
                    }),
                username: e['username'],
                usernamelabelcolor: userNameToColor(e['username']),
                });
            });
            pls += '</ul>';
            $('.available-playlists').html(pls);
            $('.hideplayliststab').slideDown('fast');
            $('.showplayliststab').slideUp('fast');
            $('.available-playlists').slideDown();
        };
    
    var error = errorFunc('error loading external playlists');
    
    api('showplaylists',success,error);
}

function confirmDeletePlaylist(id){
    $('#dialog').html(['<p>Do you really want to delete this precious playlist?</p>',
    '<a class="button" href="javascript:;" onclick="deletePlaylistAndHideDialog('+id+')">Yes, get it out of my life</a>',
    '<a class="button" href="javascript:;" onclick="$(\'#dialog\').fadeOut(\'fast\')">No, leave it as it is</a>'].join(''));
    $('#dialog').fadeIn('fast');
}

function deletePlaylistAndHideDialog(id){
    api({action:'deleteplaylist', value: id},false,errorFunc('error deleting playlist'));
    $('#dialog').fadeOut('fast');
    showPlaylists();
}

function hidePlaylists(){
    "use strict";
    $('.showplayliststab').slideDown('fast');
    $('.hideplayliststab').slideUp('fast');
    $('.available-playlists').slideUp();
}
function loadPlaylist(playlistid){
    "use strict";
    var pldomid = "#playlist"+playlistid+' .playlistcontent';
    
    if('' === $(pldomid).html().trim()){
        var data = {'action':'loadplaylist',
                    'value': playlistid };
        var success = function(data){
            $(pldomid).hide();
            $(pldomid).append(parseAndRender(data));
            $(pldomid).slideDown('slow');
            registermp3s($(pldomid).find('ul'), 'loadPlaylist');
        };
        api(data,success,errorFunc('error loading external playlist'))
    } else {
        $(pldomid).slideToggle('slow');
    }
}



var lastPlaylistHeight = 0;
function resizePlaylistSlowly(){
    var currentHeight = $('.jp-playlist').height();
    if(lastPlaylistHeight <= currentHeight){
        $('#jp-playlist-wrapper').animate({'min-height': currentHeight});
    }
    lastPlaylistHeight = currentHeight;
}

/*****
OTHER
*****/

function logout(){
    "use strict";
    var success = function(data){ reload(); };
    api('logout',success);
}


/***
ADMIN PANEL
***/
function toggleAdminPanel(){
    "use strict";
    var panel = $('#adminpanel');
    if(panel.is(":visible")){
        panel.slideUp();
    } else {
        updateUserList();
        panel.slideDown();
    }
}
function updateUserList(){
    "use strict";
    var success = function(data){
        var htmllist = "";
        var time = unixtime();
        $.each($.parseJSON(data),function(i,e){
            var reltime = time - e.last_time_online;
            var fuzzytime = time2text(reltime);
            var isonline = reltime < HEARTBEAT_INTERVAL_MS/500;
            var onlinetag = isonline ? '<span class="online-light"></span>' : '<span class="offline-light"></span>';
            if(e.admin){
                htmllist += '<li class="admin">';
            } else {
                htmllist += '<li>';
            }
            var delbutton = '';
            if(e.deletable){
                delbutton = '<a class="button" href="javascript:;" onclick="userDelete('+e.id+')">delete</a>';
            }
            htmllist += onlinetag+e.id+' - '+e.username+delbutton+' last seen: '+fuzzytime+'</li>';
        });
        $('#adminuserlist').html(htmllist);
    };
    api('getuserlist',success,errorFunc('cannot fetch user list'));
}
function addNewUser(){
    "use strict";
    var newusername = $('#newusername').val();
    var newpassword = $('#newpassword').val();
    var newisadmin = $('#chkSelect').attr('checked')?1:0;
    if(newusername.trim() === '' || newpassword.trim() === ''){
        return;
    }
    var data = {'action':'adduser',
                'value' : JSON.stringify({
                    'username':newusername,
                    'password':newpassword,
                    'isadmin':newisadmin
                })};
    var success = function(data){
        updateUserList();
    };
    api(data,success,errorFunc('failed to add new user'));
}

function userDelete(userid){
    var data = {'action':'userdelete',
                'value' : JSON.stringify({
                    'userid':userid
                })};
    var success = function(data){
        updateUserList();
    };
    api(data,success,errorFunc('failed delete user'));
}

/***
MESSAGE OF THE DAY
***/
function fetchMessageOfTheDay(){
    "use strict";
    var success = function(data){
        $('#oneliner').html(data);
    };
    api('getmotd', success, errorFunc('could not fetch message of the day'));
}

/**
TAB FUNCTIONALITY
**/
/*function showTab(tabid){
    "use strict";
    $('div.tabs '+tabid).show();
}
function hideAllTabs(){
    "use strict";
    $('div.tabs > div').each(function(){
            $(this).hide();
    });
}

function initTabs() {
    "use strict";
    hideAllTabs();
    showTab('#search');
    $('div.tabs ul.tabNavigation a').click(function () {
        $("html").scrollTop(0);
        hideAllTabs();
        showTab(this.hash);
        if('#browser' === this.hash){
            loadBrowserIfEmpty();
        }
        if('#search' === this.hash){
            $('#searchform .searchinput').focus();
        }
        $('div.tabs ul.tabNavigation a').removeClass('selected');
        $(this).addClass('selected');
        return false;
    });
    saveOriginalTabColor();
}*/

function loadBrowserIfEmpty(){
    "use strict";
    if('' === $('#browser').html().trim()){
        loadBrowser();
    }
}

function loadBrowser(){
    var data = { 'action' : 'listdir' };
    var success = function(data){
        $('#searchresults').html(parseAndRender(data));
        registerlistdirs($('#searchresults').find('ul'));
        registercompactlistdirs($('#searchresults').find('ul'));
        registermp3s($('#searchresults').find('ul'));
    };
    api(data,success,errorFunc('failed to load file browser'));
}
var origcolors = {};
function pulse(selector){
    "use strict";
    var elem = $(selector);
    if(typeof origcolors[selector] === 'undefined'){
        origcolors[selector] = elem.css('background-color');
    }
    elem.stop(true, true);
    elem.animate({backgroundColor: '#ffffff'+' !important'},100);
    elem.animate({backgroundColor: origcolors[selector]+' !important'},100);
    elem.animate({backgroundColor: '#ffffff'+' !important'},100);
    elem.animate({backgroundColor: origcolors[selector]+' !important'},100);
    elem.animate({backgroundColor: '#ffffff'+' !important'},100);
    elem.animate({backgroundColor: origcolors[selector]+' !important'},100);
}

/***
HELPER
***/

function reload(){
    "use strict";
    window.location = "http://"+window.location.host;
}
function endsWith(str, suffix) {
    "use strict";
    return str.indexOf(suffix, str.length - suffix.length) !== -1;
}
function getFileTypeByExt(filepath){
    "use strict";
    var extmatch = filepath.match(/.*?\.(\w+)$/);
    if(extmatch){
        return extmatch[1].toLowerCase();
    }
}

function detectBrowser(){
    var browsers = ['firefox','msie','chrome','safari','midori']
    for(var i=0; i<browsers.length; i++){
        if(navigator.userAgent.toLowerCase().indexOf(browsers[i])!=-1){
            return browsers[i];
        }
    }
    return 'unknown';
}
/********************
STYLE TRANSFORMATIONS
*********************/
//returns the size of the browser window
function viewport() {
    var e = window, a = 'inner';
    if ( !( 'innerWidth' in window ) ){
        a = 'client';
        e = document.documentElement || document.body;
    }
    return { width : e[ a+'Width' ] , height : e[ a+'Height' ] }
}

function mobileShowSearch(){
    $('#search').css('display','inherit');
    $('#jplayer').css('display','none');
}
function mobileShowPlaylists(){
    $('#jplayer').css('display','inherit');
    $('#search').css('display','none');
}

/*****
 * UTIL
 * ***/
function unixtime(){
    var d = new Date;
    return parseInt(d.getTime() / 1000);
}

function time2text(sec){
    var abssec = Math.abs(sec);
    var minutes = parseInt(abssec/60);
    var hours = parseInt(minutes/60)
    var days = parseInt(hours/24);
    var weeks = parseInt(days/7);
    var months = parseInt(days/30);
    var years = parseInt(months/12);
    var t='';
    if(abssec < 30){
        return 'just now'
    } else {
        if(years != 0){
            years+' years';
            if(years > 20){
                return 'never';
            }
        } else if(months != 0){
            t = months+' months';
        } else if(weeks != 0){
            t = weeks+' weeks';
        } else if(days != 0){
            t = days+' days';
        } else if(hours != 0){
            t = hours == 1 ? 'an hour' : hours+' hours';
        } else if(minutes != 0){
            t = minutes > 25 ? 'half an hour' : minutes+' minutes';
            if (minutes == 1){
                t = 'a minute';
            }
        } else {
            t = 'a few seconds'
        }
        return sec > 0 ? t+' ago' : 'in '+t;
    }
}

function showPlaylistBrowser(){
    playlistManager.hideAll();
    $('#playlistCommands').html("");
    playlistManager.setEditingPlaylist(0);
    showPlaylists();
    $('#addPlaylist ul li').addClass('active');
    $('#playlistBrowser').show();
}
/***
ON DOCUMENT READY... STEADY... GO!
***/
var playlistManager;
$(document).ready(function(){
    "use strict";
    //initTabs();
    $('#playlistBrowser').hide();
    fetchMessageOfTheDay();
    $('#searchfield .bigbutton').click(submitsearch);
    $('.hideplaylisttab').hide();
    executeAfterConfigLoaded.push(setAvailableJPlayerFormats);
    executeAfterConfigLoaded.push(function(){ playlistManager = new PlaylistManager() });
    //executeAfterConfigLoaded.push(restorePlaylistAndRememberPeriodically);
    loadConfig();
    //register top level directories
	registerlistdirs($("html").get());
	registercompactlistdirs($("html").get());
	$('div#progressscreen').fadeOut('slow');
    //window.setInterval("displayCurrentSong()", 1000);
    window.setInterval("resizePlaylistSlowly()",2000);
    $('#searchform .searchinput').focus();
    window.setInterval("api('heartbeat',false,errorFunc('connection to server lost'),true)",HEARTBEAT_INTERVAL_MS);
    $('a.search').click(function(){
        mobileShowSearch();
        $(this).blur();
        return false;
    });
    $('a.jplayer').click( function(){
        mobileShowPlaylists()
        $(this).blur();
        return false;
    });
    mobileShowSearch();
});
