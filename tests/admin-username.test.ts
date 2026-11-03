import test from 'node:test';
import assert from 'node:assert/strict';
import {adminEmailForUsername} from '../lib/data/admin-username.ts';
test('admin username resolves only a unique allowlisted account',()=>{
 assert.equal(adminEmailForUsername(' AlAguaPapos ','alaguapapos@gmail.com'),'alaguapapos@gmail.com');
 assert.equal(adminEmailForUsername('other','alaguapapos@gmail.com'),null);
 assert.equal(adminEmailForUsername('alaguapapos@gmail.com','alaguapapos@gmail.com'),null);
 assert.equal(adminEmailForUsername('owner','owner@example.com,owner@another.com'),null);
 assert.equal(adminEmailForUsername('owner','owner@example.com,owner@example.com'),'owner@example.com');
 assert.equal(adminEmailForUsername('owner',''),null);
});
