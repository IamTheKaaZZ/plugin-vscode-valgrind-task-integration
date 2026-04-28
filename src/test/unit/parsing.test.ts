import * as assert from 'assert';
import { parseValgrindPid, isVgdbReady } from '../../lib/parsing';

describe('parseValgrindPid', () => {
  it('should extract PID from a standard valgrind output line', () => {
    assert.strictEqual(parseValgrindPid('==12345== Using Valgrind-3.18.1'), '12345');
  });

  it('should extract PID from a minimal valgrind prefix', () => {
    assert.strictEqual(parseValgrindPid('==1== '), '1');
  });

  it('should extract PID from a large PID number', () => {
    assert.strictEqual(parseValgrindPid('==9999999== Memcheck, a memory error detector'), '9999999');
  });

  it('should return null for lines without valgrind prefix', () => {
    assert.strictEqual(parseValgrindPid('Starting valgrind...'), null);
  });

  it('should return null for empty string', () => {
    assert.strictEqual(parseValgrindPid(''), null);
  });

  it('should return null for lines with similar but incorrect format', () => {
    assert.strictEqual(parseValgrindPid('= =12345== not valid'), null);
  });

  it('should return null for lines with non-numeric PID', () => {
    assert.strictEqual(parseValgrindPid('==abc== not a pid'), null);
  });

  it('should handle the TO DEBUG THIS PROCESS line', () => {
    assert.strictEqual(parseValgrindPid('==54321== TO DEBUG THIS PROCESS USING GDB: start GDB like this'), '54321');
  });

  it('should handle ERROR SUMMARY line', () => {
    assert.strictEqual(parseValgrindPid('==11223== ERROR SUMMARY: 0 errors from 0 contexts'), '11223');
  });

  it('should handle valgrind leak summary lines', () => {
    assert.strictEqual(parseValgrindPid('==42==    definitely lost: 0 bytes in 0 blocks'), '42');
  });
});

describe('isVgdbReady', () => {
  it('should return true for the TO DEBUG THIS PROCESS line', () => {
    assert.strictEqual(isVgdbReady('==54321== TO DEBUG THIS PROCESS USING GDB: start GDB like this'), true);
  });

  it('should return false for normal valgrind output', () => {
    assert.strictEqual(isVgdbReady('==12345== Memcheck, a memory error detector'), false);
  });

  it('should return false for empty string', () => {
    assert.strictEqual(isVgdbReady(''), false);
  });

  it('should return false for PID-only lines', () => {
    assert.strictEqual(isVgdbReady('==12345== Command: /usr/bin/myapp'), false);
  });

  it('should return true regardless of PID prefix', () => {
    assert.strictEqual(isVgdbReady('==1== TO DEBUG THIS PROCESS'), true);
  });
});
