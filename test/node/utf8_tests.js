'use strict';

const { Buffer } = require('buffer');
const BSON = require('../register-bson');
const { isBrowser } = require('./tools/utils');
const BSONError = BSON.BSONError;

describe.only('UTF8 validation', function () {
  // Test both browser shims and node which have different replacement mechanisms
  const replacementChar = isBrowser() ? '���' : '�';
  const replacementString = `hi${replacementChar}bye`;
  const twoCharReplacementStr = `${replacementChar}${replacementChar}bye`;
  const sampleValidUTF8 = BSON.serialize({
    a: '😎',
    b: 'valid utf8',
    c: 12345
  });

  it('should throw error if true and false mixed for validation option passed in with valid utf8 example', function () {
    const mixedTrueFalse1 = { validation: { utf8: { a: false, b: true } } };
    const mixedTrueFalse2 = { validation: { utf8: { a: true, b: true, c: false } } };
    expect(() => BSON.deserialize(sampleValidUTF8, mixedTrueFalse1)).to.throw(
      BSONError,
      'Invalid UTF-8 validation option - keys must be all true or all false'
    );
    expect(() => BSON.deserialize(sampleValidUTF8, mixedTrueFalse2)).to.throw(
      BSONError,
      'Invalid UTF-8 validation option - keys must be all true or all false'
    );
  });

  it('should correctly handle validation if validation option contains all T or all F with valid utf8 example', function () {
    let allTrue = { validation: { utf8: { a: true, b: true, c: true } } };
    let allFalse = { validation: { utf8: { a: false, b: false, c: false, d: false } } };
    expect(() => BSON.deserialize(sampleValidUTF8, allTrue)).to.not.throw();
    expect(() => BSON.deserialize(sampleValidUTF8, allFalse)).to.not.throw();
  });

  it('should throw error if empty utf8 validation option passed in', function () {
    var doc = { a: 'validation utf8 option cant be empty' };
    const serialized = BSON.serialize(doc);
    let emptyUTF8validation = { validation: { utf8: {} } };
    expect(() => BSON.deserialize(serialized, emptyUTF8validation)).to.throw(
      BSONError,
      'validation option is empty'
    );
  });

  const testInputs = [
    {
      description: 'object with valid utf8 top level keys',
      buffer: Buffer.from(
        '2e0000000276616c69644b65794368617200060000006162636465001076616c69644b65794e756d003930000000',
        'hex'
      ),
      expectedObjectWithReplacementChars: {
        validKeyChar: 'abcde',
        validKeyNum: 12345
      },
      containsInvalid: false
    },
    {
      description: 'object with invalid utf8 top level key',
      buffer: Buffer.from(
        '420000000276616c69644b657943686172000600000061626364650002696e76616c696455746638546f704c6576656c4b657900090000006869f09f906279650000',
        'hex'
      ),
      expectedObjectWithReplacementChars: {
        validKeyChar: 'abcde',
        invalidUtf8TopLevelKey: replacementString
      },
      containsInvalid: true
    },
    {
      description: 'object with invalid utf8 in nested key',
      buffer: Buffer.from(
        '460000000276616c69644b657943686172000600000061626364650003746f704c766c4b6579001e00000002696e76616c69644b657900090000006869f09f90627965000000',
        'hex'
      ),
      expectedObjectWithReplacementChars: {
        validKeyChar: 'abcde',
        topLvlKey: {
          invalidKey: replacementString
        }
      },
      containsInvalid: true
    },
    {
      description: 'object with invalid utf8 in nested key',
      buffer: Buffer.from(
        '5e0000000276616c69644b65794368617200040000006162630002696e76616c696455746638546f704c766c3100090000006869f09f906279650002696e76616c696455746638546f704c766c32000a000000f09f90f09f906279650000',
        'hex'
      ),
      expectedObjectWithReplacementChars: {
        validKeyChar: 'abc',
        invalidUtf8TopLvl1: replacementString,
        invalidUtf8TopLvl2: twoCharReplacementStr
      },
      containsInvalid: true
    }
  ];

  for (const {
    description,
    containsInvalid,
    buffer,
    expectedObjectWithReplacementChars
  } of testInputs) {
    const behavior = 'validate utf8 if no validation option given';
    it(`should ${behavior} for ${description}`, function () {
      if (containsInvalid) {
        expect(() => BSON.deserialize(buffer)).to.throw(
          BSONError,
          'Invalid UTF-8 string in BSON document'
        );
      } else {
        expect(BSON.deserialize(buffer)).to.deep.equals(expectedObjectWithReplacementChars);
      }
    });
  }

  for (const { description, buffer, expectedObjectWithReplacementChars } of testInputs) {
    const behavior = 'not validate utf8 and not throw an error';
    it(`should ${behavior} for ${description} with global utf8 validation disabled`, function () {
      const validation = { validation: { utf8: false } };
      expect(BSON.deserialize(buffer, validation)).to.deep.equals(
        expectedObjectWithReplacementChars
      );
    });
  }

  for (const {
    description,
    containsInvalid,
    buffer,
    expectedObjectWithReplacementChars
  } of testInputs) {
    const behavior = containsInvalid ? 'throw error' : 'validate utf8 with no errors';
    it(`should ${behavior} for ${description} with global utf8 validation enabled`, function () {
      const validation = { validation: { utf8: true } };
      if (containsInvalid) {
        expect(() => BSON.deserialize(buffer, validation)).to.throw(
          BSONError,
          'Invalid UTF-8 string in BSON document'
        );
      } else {
        expect(BSON.deserialize(buffer, validation)).to.deep.equals(
          expectedObjectWithReplacementChars
        );
      }
    });
  }

  const utf8ValidationSpecifiedKeys = [
    {
      validation: { validation: { utf8: { validKeyChar: false } } },
      behavior:
        'throw error when valid toplevel key has validation disabled but invalid toplevel key has validation enabled'
    },
    {
      validation: { validation: { utf8: { invalidUtf8TopLevelKey: false } } },
      behavior:
        'not throw when invalid toplevel key has validation disabled but valid toplevel key has validation enabled'
    },
    {
      validation: { validation: { utf8: { validKeyChar: false, invalidUtf8TopLevelKey: false } } },
      behavior: 'not throw when both valid and invalid toplevel keys have validation disabled'
    },
    {
      validation: { validation: { utf8: { validKeyChar: true } } },
      behavior:
        'not throw when valid toplevel key has validation enabled and invalid toplevel key has validation disabled'
    },
    {
      validation: { validation: { utf8: { invalidUtf8TopLevelKey: true } } },
      behavior:
        'throw error when invalid toplevel key has validation enabled but valid toplevel key has validation disabled'
    },
    {
      validation: { validation: { utf8: { validKeyChar: true, invalidUtf8TopLevelKey: true } } },
      behavior: 'throw error when both valid and invalid toplevel keys have validation enabled'
    }
  ];

  for (const { behavior, validation } of utf8ValidationSpecifiedKeys) {
    const topLvlKeysEx = testInputs[1];
    it(`should ${behavior}`, function () {
      if (behavior.substring(0, 3) === 'not') {
        expect(BSON.deserialize(topLvlKeysEx.buffer, validation)).to.deep.equals(
          topLvlKeysEx.expectedObjectWithReplacementChars
        );
      } else {
        expect(() => BSON.deserialize(topLvlKeysEx.buffer, validation)).to.throw(
          BSONError,
          'Invalid UTF-8 string in BSON document'
        );
      }
    });
  }

  const utf8ValidationNestedInvalidKey = [
    {
      validation: { validation: { utf8: { validKeyChar: false } } },
      behavior:
        'throw error when valid toplevel key has validation disabled but invalid nested key is validated'
    },
    {
      validation: { validation: { utf8: { topLvlKey: false } } },
      behavior:
        'not throw when toplevel key with invalid subkey has validation disabled but valid toplevel key is validated'
    },
    {
      validation: { validation: { utf8: { invalidKey: false } } },
      behavior:
        'throw error when specified invalid key for disabling validation is not a top level key'
    },
    {
      validation: { validation: { utf8: { validKeyChar: false, topLvlKey: false } } },
      behavior:
        'not throw when both valid top level key and toplevel key with invalid subkey have validation disabled'
    },
    {
      validation: { validation: { utf8: { validKeyChar: true } } },
      behavior:
        'not throw when valid toplevel key has validation enabled and invalid nested key is not validated'
    },
    {
      validation: { validation: { utf8: { topLvlKey: true } } },
      behavior:
        'throw error when toplevel key containing nested invalid key has validation enabled but valid key is not validated'
    },
    {
      validation: { validation: { utf8: { validKeyChar: true, topLvlKey: true } } },
      behavior:
        'throw error when both valid key and nested invalid toplevel keys have validation enabled'
    }
  ];

  for (const { behavior, validation } of utf8ValidationNestedInvalidKey) {
    const nestedKeysEx = testInputs[2];
    it(`should ${behavior}`, function () {
      if (behavior.substring(0, 3) === 'not') {
        expect(BSON.deserialize(nestedKeysEx.buffer, validation)).to.deep.equals(
          nestedKeysEx.expectedObjectWithReplacementChars
        );
      } else {
        expect(() => BSON.deserialize(nestedKeysEx.buffer, validation)).to.throw(
          BSONError,
          'Invalid UTF-8 string in BSON document'
        );
      }
    });
  }

  const utf8ValidationMultipleInvalidKeys = [
    {
      validation: { validation: { utf8: { invalidUtf8TopLvl1: false } } },
      behavior: 'throw error when only one of two invalid top level keys has validation disabled'
    },
    {
      validation: {
        validation: { utf8: { invalidUtf8TopLvl1: false, invalidUtf8TopLvl2: false } }
      },
      behavior: 'not throw when all invalid top level keys have validation disabled'
    },
    {
      validation: { validation: { utf8: { validKeyChar: true } } },
      behavior: 'not throw when only the valid top level key has enabled validation'
    },
    {
      validation: { validation: { utf8: { validKeyChar: true, invalidUtf8TopLvl1: true } } },
      behavior:
        'throw error when only the valid toplevel key and one of the invalid keys has enabled validation'
    }
  ];

  for (const { behavior, validation } of utf8ValidationMultipleInvalidKeys) {
    const nestedKeysEx = testInputs[3];
    it(`should ${behavior}`, function () {
      if (behavior.substring(0, 3) === 'not') {
        expect(BSON.deserialize(nestedKeysEx.buffer, validation)).to.deep.equals(
          nestedKeysEx.expectedObjectWithReplacementChars
        );
      } else {
        expect(() => BSON.deserialize(nestedKeysEx.buffer, validation)).to.throw(
          BSONError,
          'Invalid UTF-8 string in BSON document'
        );
      }
    });
  }
});
