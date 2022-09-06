/**
 * @param ob Object                 The object to flatten
 * @param prefix String (Optional)  The prefix to add before each key, also used for recursion
 **/
 function flattenObject(ob, prefix = false, result = null) {
    result = result || {};
  
    // Preserve empty objects and arrays, they are lost otherwise
    if (prefix && typeof ob === 'object' && ob !== null && Object.keys(ob).length === 0) {
      result[prefix] = Array.isArray(ob) ? [] : {};
      return result;
    }
  
    prefix = prefix ? prefix + '.' : '';
  
    for (const i in ob) {
      if (Object.prototype.hasOwnProperty.call(ob, i)) {
        if (typeof ob[i] === 'object' && ob[i] !== null) {
          // Recursion on deeper objects
          flattenObject(ob[i], prefix + i, result);
        } else {
          result[prefix + i] = ob[i];
        }
      }
    }
    return result;
  }
  
  /**
   * Bonus function to unflatten an object
   *
   * @param ob Object     The object to unflatten
   */
  function unflattenObject(ob) {
    const result = {};
    for (const i in ob) {
      if (Object.prototype.hasOwnProperty.call(ob, i)) {
        const keys = i.match(/(?:^\.+)?(?:\.{2,}|[^.])+(?:\.+$)?/g); // Just a complicated regex to only match a single dot in the middle of the string
        keys.reduce((r, e, j) => {
          return r[e] || (r[e] = isNaN(Number(keys[j + 1])) ? (keys.length - 1 === j ? ob[i] : {}) : []);
        }, result);
      }
    }
    return result;
  }
  
  
  // TESTS
  const obj = {
    value: {
      foo: {
        bar: 'yes',
        so: {
          freakin: {
            nested: 'Wow',
          }
        }
      },
    },
    // Some edge cases to test
    test: [true, false, [null, undefined, 1]],
    not_lost: [], // Empty arrays should be preserved
    not_lost2: {}, // Empty objects should be preserved
    // Be careful with object having dots in the keys
    'I.like.dots..in.object.keys...': "... Please don't override me",
    I: {
      like: {
        'dots..in': {
          object: {
            'keys...': "You've been overwritten"
          }
        }
      }
    }
  };
  console.log(flattenObject(['I', {'am': 'an array'}]));
  let flat = flattenObject(obj);
  console.log(flat, unflattenObject(flat));