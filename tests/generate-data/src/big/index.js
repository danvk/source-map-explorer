import 'core-js';
import moment from 'moment';
import _ from 'lodash-es';
import $ from 'jquery';
import Phaser from 'phaser'
import * as THREE from 'three'
import * as PIXI from 'pixi.js'

['af.js', 'ar-dz.js', 'ar-kw.js', 'ar-ly.js', 'ar-ma.js', 'ar-sa.js','ar-tn.js', 'ar.js',
 'az.js', 'be.js', 'bg.js', 'bm.js', 'bn.js', 'bo.js', 'br.js','bs.js', 'ca.js', 'cs.js',
 'cv.js', 'cy.js', 'da.js', 'de-at.js', 'de-ch.js', 'de.js', 'dv.js', 'el.js', 'en-au.js',
 'en-ca.js', 'en-gb.js', 'en-ie.js', 'en-il.js', 'en-nz.js','en-SG.js', 'eo.js', 'es-do.js',
 'es-us.js', 'es.js', 'et.js', 'eu.js', 'fa.js', 'fi.js', 'fo.js', 'fr-ca.js', 'fr-ch.js',
 'fr.js', 'fy.js', 'ga.js', 'gd.js', 'gl.js', 'gom-latn.js', 'gu.js', 'he.js', 'hi.js',
 'hr.js', 'hu.js', 'hy-am.js', 'id.js', 'is.js', 'it-ch.js', 'it.js', 'ja.js', 'jv.js',
 'ka.js', 'kk.js', 'km.js', 'kn.js', 'ko.js', 'ku.js', 'ky.js', 'lb.js', 'lo.js', 'lt.js',
 'lv.js', 'me.js', 'mi.js', 'mk.js', 'ml.js', 'mn.js', 'mr.js', 'ms-my.js', 'ms.js', 'mt.js',
 'my.js', 'nb.js', 'ne.js', 'nl-be.js', 'nl.js', 'nn.js','pa-in.js', 'pl.js', 'pt-br.js',
 'pt.js', 'ro.js', 'ru.js', 'sd.js', 'se.js', 'si.js', 'sk.js', 'sl.js', 'sq.js',
 'sr-cyrl.js', 'sr.js', 'ss.js', 'sv.js', 'sw.js', 'ta.js', 'te.js', 'tet.js', 'tg.js',
 'th.js', 'tl-ph.js', 'tlh.js', 'tr.js', 'tzl.js', 'tzm-latn.js', 'tzm.js', 'ug-cn.js',
 'uk.js', 'ur.js', 'uz-latn.js', 'uz.js', 'vi.js', 'x-pseudo.js', 'yo.js', 'zh-cn.js',
 'zh-hk.js', 'zh-tw.js'].forEach(locale => {
    require(`moment/locale/${locale}`);
  })

moment().format('MMMM Do YYYY, h:mm:ss a');

_.capitalize('hello 🌍');

$.trim(' 😮 ');

new Phaser.Game();

new THREE.Scene();

new PIXI.Application();
