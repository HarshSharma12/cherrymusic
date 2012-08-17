"""
bullshit: use the json module instead.
json.dumps(['list','of','things'])
"""

import json
from cherrymusic import util 
from urllib.parse import quote

class JSON(object):
    def __init__(self,config):
        self.config = config
    def render(self, musicentries):
        retlist = []
        for entry in musicentries:
            if entry.compact:
                #compact
                retlist.append({'type':'compact', 'urlpath':entry.path,'label':entry.repr})
            elif entry.dir:
                #dir
                simplename = util.filename(entry.path)
                retlist.append({'type':'dir', 'path':entry.path,'label':simplename})
            else:
                #file
                simplename = util.filename(entry.path)
                urlpath = quote('/'+self.config.config['hostalias']+'/'+entry.path);
                retlist.append({'type':'file',
                                'urlpath':urlpath,
                                'path':entry.path,
                                'label':simplename})
        return json.dumps(retlist)