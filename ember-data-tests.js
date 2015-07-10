define(
  "ember-data/tests/helpers/custom-adapter",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    __es6_export__("default", function (env, adapterDefinition) {
      var adapter = adapterDefinition;
      if (!DS.Adapter.detect(adapterDefinition)) {
        adapter = DS.Adapter.extend(adapterDefinition);
      }
      var store = env.store;
      env.registry.register('adapter:-custom', adapter);
      Ember.run(function () {
        return store.set('adapter', '-custom');
      });
    });
  }
);


define(
  "ember-data/tests/integration/adapter/build-url-mixin-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, adapter, Post, Comment, SuperUser;
    var passedUrl;
    var run = Ember.run;

    module("integration/adapter/build-url-mixin - BuildURLMixin with RESTAdapter", {
      setup: function () {
        Post = DS.Model.extend({
          name: DS.attr("string")
        });

        Post.toString = function () {
          return "Post";
        };

        Comment = DS.Model.extend({
          name: DS.attr("string")
        });

        SuperUser = DS.Model.extend();

        env = setupStore({
          post: Post,
          comment: Comment,
          superUser: SuperUser,
          adapter: DS.RESTAdapter
        });

        store = env.store;
        adapter = env.adapter;

        Post = store.modelFor("post");
        Comment = store.modelFor("comment");
        SuperUser = store.modelFor("super-user");

        passedUrl = null;
      }
    });

    function ajaxResponse(value) {
      adapter.ajax = function (url, verb, hash) {
        passedUrl = url;

        return run(Ember.RSVP, "resolve", Ember.copy(value, true));
      };
    }

    test("buildURL - with host and namespace", function () {
      run(function () {
        adapter.setProperties({
          host: "http://example.com",
          namespace: "api/v1"
        });
      });

      ajaxResponse({ posts: [{ id: 1 }] });

      run(store, "findRecord", "post", 1).then(async(function (post) {
        equal(passedUrl, "http://example.com/api/v1/posts/1");
      }));
    });

    test("buildURL - with relative paths in links", function () {
      run(function () {
        adapter.setProperties({
          host: "http://example.com",
          namespace: "api/v1"
        });
      });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      ajaxResponse({ posts: [{ id: 1, links: { comments: "comments" } }] });

      run(store, "findRecord", "post", "1").then(async(function (post) {
        ajaxResponse({ comments: [{ id: 1 }] });
        return post.get("comments");
      })).then(async(function (comments) {
        equal(passedUrl, "http://example.com/api/v1/posts/1/comments");
      }));
    });

    test("buildURL - with absolute paths in links", function () {
      run(function () {
        adapter.setProperties({
          host: "http://example.com",
          namespace: "api/v1"
        });
      });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      ajaxResponse({ posts: [{ id: 1, links: { comments: "/api/v1/posts/1/comments" } }] });

      run(store, "findRecord", "post", 1).then(async(function (post) {
        ajaxResponse({ comments: [{ id: 1 }] });
        return post.get("comments");
      })).then(async(function (comments) {
        equal(passedUrl, "http://example.com/api/v1/posts/1/comments");
      }));
    });

    test("buildURL - with absolute paths in links and protocol relative host", function () {
      run(function () {
        adapter.setProperties({
          host: "//example.com",
          namespace: "api/v1"
        });
      });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      ajaxResponse({ posts: [{ id: 1, links: { comments: "/api/v1/posts/1/comments" } }] });

      run(store, "findRecord", "post", 1).then(async(function (post) {
        ajaxResponse({ comments: [{ id: 1 }] });
        return post.get("comments");
      })).then(async(function (comments) {
        equal(passedUrl, "//example.com/api/v1/posts/1/comments");
      }));
    });

    test("buildURL - with full URLs in links", function () {
      adapter.setProperties({
        host: "http://example.com",
        namespace: "api/v1"
      });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      ajaxResponse({
        posts: [{ id: 1,
          links: { comments: "http://example.com/api/v1/posts/1/comments" }
        }]
      });

      run(function () {
        store.findRecord("post", 1).then(async(function (post) {
          ajaxResponse({ comments: [{ id: 1 }] });
          return post.get("comments");
        })).then(async(function (comments) {
          equal(passedUrl, "http://example.com/api/v1/posts/1/comments");
        }));
      });
    });

    test("buildURL - with camelized names", function () {
      adapter.setProperties({
        pathForType: function (type) {
          var decamelized = Ember.String.decamelize(type);
          return Ember.String.underscore(Ember.String.pluralize(decamelized));
        }
      });

      ajaxResponse({ superUsers: [{ id: 1 }] });

      run(function () {
        store.findRecord("super-user", 1).then(async(function (post) {
          equal(passedUrl, "/super_users/1");
        }));
      });
    });

    test("buildURL - buildURL takes a record from find", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      adapter.buildURL = function (type, id, snapshot) {
        return "/posts/" + snapshot.belongsTo("post", { id: true }) + "/comments/" + snapshot.id;
      };

      ajaxResponse({ comments: [{ id: 1 }] });

      var post;
      run(function () {
        post = store.push("post", { id: 2 });
      });

      run(function () {
        store.findRecord("comment", 1, { preload: { post: post } }).then(async(function (post) {
          equal(passedUrl, "/posts/2/comments/1");
        }));
      });
    });

    test("buildURL - buildURL takes the records from findMany", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });

      adapter.buildURL = function (type, ids, snapshots) {
        if (Ember.isArray(snapshots)) {
          return "/posts/" + snapshots.get("firstObject").belongsTo("post", { id: true }) + "/comments/";
        }
        return "";
      };
      adapter.coalesceFindRequests = true;

      ajaxResponse({ comments: [{ id: 1 }, { id: 2 }, { id: 3 }] });
      var post;

      run(function () {
        post = store.push("post", { id: 2, comments: [1, 2, 3] });
        post.get("comments").then(async(function (post) {
          equal(passedUrl, "/posts/2/comments/");
        }));
      });
    });

    test("buildURL - buildURL takes a record from create", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      adapter.buildURL = function (type, id, snapshot) {
        return "/posts/" + snapshot.belongsTo("post", { id: true }) + "/comments/";
      };

      ajaxResponse({ comments: [{ id: 1 }] });

      run(function () {
        var post = store.push("post", { id: 2 });
        var comment = store.createRecord("comment");
        comment.set("post", post);
        comment.save().then(async(function (post) {
          equal(passedUrl, "/posts/2/comments/");
        }));
      });
    });

    test("buildURL - buildURL takes a record from create to query a resolved async belongsTo relationship", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: true }) });

      ajaxResponse({ posts: [{ id: 2 }] });

      run(function () {
        store.findRecord("post", 2).then(async(function (post) {
          equal(post.get("id"), 2);

          adapter.buildURL = function (type, id, snapshot) {
            return "/posts/" + snapshot.belongsTo("post", { id: true }) + "/comments/";
          };

          ajaxResponse({ comments: [{ id: 1 }] });

          var comment = store.createRecord("comment");
          comment.set("post", post);
          comment.save().then(async(function (post) {
            equal(passedUrl, "/posts/2/comments/");
          }));
        }));
      });
    });

    test("buildURL - buildURL takes a record from update", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      adapter.buildURL = function (type, id, snapshot) {
        return "/posts/" + snapshot.belongsTo("post", { id: true }) + "/comments/" + snapshot.id;
      };

      ajaxResponse({ comments: [{ id: 1 }] });

      var post, comment;
      run(function () {
        post = store.push("post", { id: 2 });
        comment = store.push("comment", { id: 1 });
        comment.set("post", post);
      });
      run(function () {
        comment.save().then(async(function (post) {
          equal(passedUrl, "/posts/2/comments/1");
        }));
      });
    });

    test("buildURL - buildURL takes a record from delete", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      Post.reopen({ comments: DS.hasMany("comment", { async: false }) });
      adapter.buildURL = function (type, id, snapshot) {
        return "posts/" + snapshot.belongsTo("post", { id: true }) + "/comments/" + snapshot.id;
      };

      ajaxResponse({ comments: [{ id: 1 }] });

      var post, comment;
      run(function () {
        post = store.push("post", { id: 2 });
        comment = store.push("comment", { id: 1 });

        comment.set("post", post);
        comment.deleteRecord();
      });
      run(function () {
        comment.save().then(async(function (post) {
          equal(passedUrl, "posts/2/comments/1");
        }));
      });
    });

    test("buildURL - with absolute namespace", function () {
      run(function () {
        adapter.setProperties({
          namespace: "/api/v1"
        });
      });

      ajaxResponse({ posts: [{ id: 1 }] });

      run(store, "findRecord", "post", 1).then(async(function (post) {
        equal(passedUrl, "/api/v1/posts/1");
      }));
    });
  }
);


define(
  "ember-data/tests/integration/adapter/find-all-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var Person, store, allRecords;
    var run = Ember.run;
    var env;

    module('integration/adapter/find_all - Finding All Records of a Type', {
      setup: function () {
        Person = DS.Model.extend({
          updatedAt: DS.attr('string'),
          name: DS.attr('string'),
          firstName: DS.attr('string'),
          lastName: DS.attr('string')
        });

        allRecords = null;

        env = setupStore({
          person: Person
        });
        store = env.store;
      },

      teardown: function () {
        run(function () {
          if (allRecords) {
            allRecords.destroy();
          }
          store.destroy();
        });
      }
    });

    test('When all records for a type are requested, the store should call the adapter\'s `findAll` method.', function () {
      expect(5);

      env.registry.register('adapter:person', DS.Adapter.extend({
        findAll: function (store, type, since) {
          // this will get called twice
          ok(true, 'the adapter\'s findAll method should be invoked');

          return Ember.RSVP.resolve([{ id: 1, name: 'Braaaahm Dale' }]);
        }
      }));

      var allRecords;

      run(function () {
        store.findAll('person').then(function (all) {
          allRecords = all;
          equal(get(all, 'length'), 1, 'the record array\'s length is 1 after a record is loaded into it');
          equal(all.objectAt(0).get('name'), 'Braaaahm Dale', 'the first item in the record array is Braaaahm Dale');
        });
      });

      run(function () {
        store.findAll('person').then(function (all) {
          // Only one record array per type should ever be created (identity map)
          strictEqual(allRecords, all, 'the same record array is returned every time all records of a type are requested');
        });
      });
    });

    test('When all records for a type are requested, a rejection should reject the promise', function () {
      expect(5);

      var count = 0;
      env.registry.register('adapter:person', DS.Adapter.extend({
        findAll: function (store, type, since) {
          // this will get called twice
          ok(true, 'the adapter\'s findAll method should be invoked');

          if (count++ === 0) {
            return Ember.RSVP.reject();
          } else {
            return Ember.RSVP.resolve([{ id: 1, name: 'Braaaahm Dale' }]);
          }
        }
      }));

      var allRecords;

      run(function () {
        store.findAll('person').then(null, function () {
          ok(true, 'The rejection should get here');
          return store.findAll('person');
        }).then(function (all) {
          allRecords = all;
          equal(get(all, 'length'), 1, 'the record array\'s length is 1 after a record is loaded into it');
          equal(all.objectAt(0).get('name'), 'Braaaahm Dale', 'the first item in the record array is Braaaahm Dale');
        });
      });
    });

    test('When all records for a type are requested, records that are already loaded should be returned immediately.', function () {
      expect(3);
      store = createStore({
        adapter: DS.Adapter.extend(),
        person: Person
      });

      run(function () {
        // Load a record from the server
        store.push('person', { id: 1, name: 'Jeremy Ashkenas' });
        // Create a new, unsaved record in the store
        store.createRecord('person', { name: 'Alex MacCaw' });
      });

      allRecords = store.peekAll('person');

      equal(get(allRecords, 'length'), 2, 'the record array\'s length is 2');
      equal(allRecords.objectAt(0).get('name'), 'Jeremy Ashkenas', 'the first item in the record array is Jeremy Ashkenas');
      equal(allRecords.objectAt(1).get('name'), 'Alex MacCaw', 'the second item in the record array is Alex MacCaw');
    });

    test('When all records for a type are requested, records that are created on the client should be added to the record array.', function () {
      expect(3);

      store = createStore({
        adapter: DS.Adapter.extend(),
        person: Person
      });

      allRecords = store.peekAll('person');

      equal(get(allRecords, 'length'), 0, 'precond - the record array\'s length is zero before any records are loaded');

      run(function () {
        store.createRecord('person', { name: 'Carsten Nielsen' });
      });

      equal(get(allRecords, 'length'), 1, 'the record array\'s length is 1');
      equal(allRecords.objectAt(0).get('name'), 'Carsten Nielsen', 'the first item in the record array is Carsten Nielsen');
    });
  }
);


define(
  "ember-data/tests/integration/adapter/find-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Person, store, env;
    var run = Ember.run;

    module('integration/adapter/find - Finding Records', {
      setup: function () {
        Person = DS.Model.extend({
          updatedAt: DS.attr('string'),
          name: DS.attr('string'),
          firstName: DS.attr('string'),
          lastName: DS.attr('string')
        });

        env = setupStore({
          person: Person
        });
        store = env.store;
      },

      teardown: function () {
        run(store, 'destroy');
      }
    });

    test('It raises an assertion when no type is passed', function () {
      expectAssertion(function () {
        store.find();
      }, 'You need to pass a type to the store\'s find method');
    });

    test('It raises an assertion when `undefined` is passed as id (#1705)', function () {
      expectAssertion(function () {
        store.find('person', undefined);
      }, 'You may not pass `undefined` as id to the store\'s find method');

      expectAssertion(function () {
        store.find('person', null);
      }, 'You may not pass `null` as id to the store\'s find method');
    });

    test('store.findAll should trigger a deprecation warning about store.shouldReloadAll', function () {
      env.adapter.findAll = function () {
        return Ember.RSVP.resolve([]);
      };

      run(function () {
        expectDeprecation(function () {
          store.findAll('person');
        }, 'The default behavior of shouldReloadAll will change in Ember Data 2.0 to always return false when there is at least one "person" record in the store. If you would like to preserve the current behavior please override shouldReloadAll in your adapter:application and return true.');
      });
    });

    test('When a single record is requested, the adapter\'s find method should be called unless it\'s loaded.', function () {
      expect(2);

      var count = 0;

      env.registry.register('adapter:person', DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          equal(type, Person, 'the find method is called with the correct type');
          equal(count, 0, 'the find method is only called once');

          count++;
          return { id: 1, name: 'Braaaahm Dale' };
        }
      }));

      run(function () {
        store.findRecord('person', 1);
        store.findRecord('person', 1);
      });
    });

    test('When a single record is requested multiple times, all .find() calls are resolved after the promise is resolved', function () {
      var deferred = Ember.RSVP.defer();

      env.registry.register('adapter:person', DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return deferred.promise;
        }
      }));

      run(function () {
        store.findRecord('person', 1).then(async(function (person) {
          equal(person.get('id'), '1');
          equal(person.get('name'), 'Braaaahm Dale');

          stop();
          deferred.promise.then(function (value) {
            start();
            ok(true, 'expected deferred.promise to fulfill');
          }, function (reason) {
            start();
            ok(false, 'expected deferred.promise to fulfill, but rejected');
          });
        }));
      });

      run(function () {
        store.findRecord('person', 1).then(async(function (post) {
          equal(post.get('id'), '1');
          equal(post.get('name'), 'Braaaahm Dale');

          stop();
          deferred.promise.then(function (value) {
            start();
            ok(true, 'expected deferred.promise to fulfill');
          }, function (reason) {
            start();
            ok(false, 'expected deferred.promise to fulfill, but rejected');
          });
        }));
      });

      Ember.run(function () {
        deferred.resolve({ id: 1, name: 'Braaaahm Dale' });
      });
    });

    test('When a single record is requested, and the promise is rejected, .find() is rejected.', function () {
      env.registry.register('adapter:person', DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.reject();
        }
      }));

      run(function () {
        store.findRecord('person', 1).then(null, async(function (reason) {
          ok(true, 'The rejection handler was called');
        }));
      });
    });

    test('When a single record is requested, and the promise is rejected, the record should be unloaded.', function () {
      expect(2);

      env.registry.register('adapter:person', DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.reject();
        }
      }));

      run(function () {
        store.findRecord('person', 1).then(null, async(function (reason) {
          ok(true, 'The rejection handler was called');
        }));
      });

      ok(!store.hasRecordForId('person', 1), 'The record has been unloaded');
    });
  }
);


define(
  "ember-data/tests/integration/adapter/json-api-adapter-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, adapter;
    var passedUrl, passedVerb, passedHash;

    var run = Ember.run;

    var User, Post, Comment, Handle, GithubHandle, TwitterHandle, Company, DevelopmentShop, DesignStudio;

    module('integration/adapter/json-api-adapter - JSONAPIAdapter', {
      setup: function () {
        User = DS.Model.extend({
          firstName: DS.attr('string'),
          lastName: DS.attr('string'),
          posts: DS.hasMany('post', { async: true }),
          handles: DS.hasMany('handle', { async: true, polymorphic: true }),
          company: DS.belongsTo('company', { async: true, polymorphic: true })
        });

        Post = DS.Model.extend({
          title: DS.attr('string'),
          author: DS.belongsTo('user', { async: true }),
          comments: DS.hasMany('comment', { async: true })
        });

        Comment = DS.Model.extend({
          text: DS.attr('string'),
          post: DS.belongsTo('post', { async: true })
        });

        Handle = DS.Model.extend({
          user: DS.belongsTo('user', { async: true })
        });

        GithubHandle = Handle.extend({
          username: DS.attr('string')
        });

        TwitterHandle = Handle.extend({
          nickname: DS.attr('string')
        });

        Company = DS.Model.extend({
          name: DS.attr('string'),
          employees: DS.hasMany('user', { async: true })
        });

        DevelopmentShop = Company.extend({
          coffee: DS.attr('boolean')
        });

        DesignStudio = Company.extend({
          hipsters: DS.attr('number')
        });

        env = setupStore({
          adapter: DS.JSONAPIAdapter,

          'user': User,
          'post': Post,
          'comment': Comment,
          'handle': Handle,
          'github-handle': GithubHandle,
          'twitter-handle': TwitterHandle,
          'company': Company,
          'development-shop': DevelopmentShop,
          'design-studio': DesignStudio
        });

        store = env.store;
        adapter = env.adapter;
      },

      teardown: function () {
        run(env.store, 'destroy');
      }
    });

    function ajaxResponse(responses) {
      var counter = 0;
      var index;

      passedUrl = [];
      passedVerb = [];
      passedHash = [];

      adapter.ajax = function (url, verb, hash) {
        index = counter++;

        passedUrl[index] = url;
        passedVerb[index] = verb;
        passedHash[index] = hash;

        return run(Ember.RSVP, 'resolve', responses[index]);
      };
    }

    test('find a single record', function () {
      expect(3);

      ajaxResponse([{
        data: {
          type: 'post',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          }
        }
      }]);

      run(function () {
        store.find('post', 1).then(function (post) {
          equal(passedUrl[0], '/posts/1');

          equal(post.get('id'), '1');
          equal(post.get('title'), 'Ember.js rocks');
        });
      });
    });

    test('find all records with sideloaded relationships', function () {
      expect(9);

      ajaxResponse([{
        data: [{
          type: 'posts',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          },
          relationships: {
            author: {
              data: { type: 'users', id: '3' }
            }
          }
        }, {
          type: 'posts',
          id: '2',
          attributes: {
            title: 'Tomster rules'
          },
          relationships: {
            author: {
              data: { type: 'users', id: '3' }
            },
            comments: {
              data: [{ type: 'comments', id: '4' }, { type: 'comments', id: '5' }]
            }
          }
        }],
        included: [{
          type: 'users',
          id: '3',
          attributes: {
            'first-name': 'Yehuda',
            'last-name': 'Katz'
          }
        }, {
          type: 'comments',
          id: '4',
          attributes: {
            text: 'This is the first comment'
          }
        }, {
          type: 'comments',
          id: '5',
          attributes: {
            text: 'This is the second comment'
          }
        }]
      }]);

      run(function () {
        store.findAll('post').then(function (posts) {
          equal(passedUrl[0], '/posts');

          equal(posts.get('length'), '2');
          equal(posts.get('firstObject.title'), 'Ember.js rocks');
          equal(posts.get('lastObject.title'), 'Tomster rules');

          equal(posts.get('firstObject.author.firstName'), 'Yehuda');
          equal(posts.get('lastObject.author.lastName'), 'Katz');

          equal(posts.get('firstObject.comments.length'), 0);

          equal(posts.get('lastObject.comments.firstObject.text'), 'This is the first comment');
          equal(posts.get('lastObject.comments.lastObject.text'), 'This is the second comment');
        });
      });
    });

    test('find many records', function () {
      expect(4);

      ajaxResponse([{
        data: [{
          type: 'posts',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          }
        }]
      }]);

      run(function () {
        store.query('post', { filter: { id: 1 } }).then(function (posts) {
          equal(passedUrl[0], '/posts');
          deepEqual(passedHash[0], { data: { filter: { id: 1 } } });

          equal(posts.get('length'), '1');
          equal(posts.get('firstObject.title'), 'Ember.js rocks');
        });
      });
    });

    test('find a single record with belongsTo link as object { related }', function () {
      expect(7);

      ajaxResponse([{
        data: {
          type: 'posts',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          },
          relationships: {
            author: {
              links: {
                related: 'http://example.com/user/2'
              }
            }
          }
        }
      }, {
        data: {
          type: 'users',
          id: '2',
          attributes: {
            'first-name': 'Yehuda',
            'last-name': 'Katz'
          }
        }
      }]);

      run(function () {
        store.find('post', 1).then(function (post) {
          equal(passedUrl[0], '/posts/1');

          equal(post.get('id'), '1');
          equal(post.get('title'), 'Ember.js rocks');

          post.get('author').then(function (author) {
            equal(passedUrl[1], 'http://example.com/user/2');

            equal(author.get('id'), '2');
            equal(author.get('firstName'), 'Yehuda');
            equal(author.get('lastName'), 'Katz');
          });
        });
      });
    });

    test('find a single record with belongsTo link as object { data }', function () {
      expect(7);

      ajaxResponse([{
        data: {
          type: 'posts',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          },
          relationships: {
            author: {
              data: { type: 'users', id: '2' }
            }
          }
        }
      }, {
        data: {
          type: 'users',
          id: '2',
          attributes: {
            'first-name': 'Yehuda',
            'last-name': 'Katz'
          }
        }
      }]);

      run(function () {
        store.find('post', 1).then(function (post) {
          equal(passedUrl[0], '/posts/1');

          equal(post.get('id'), '1');
          equal(post.get('title'), 'Ember.js rocks');

          post.get('author').then(function (author) {
            equal(passedUrl[1], '/users/2');

            equal(author.get('id'), '2');
            equal(author.get('firstName'), 'Yehuda');
            equal(author.get('lastName'), 'Katz');
          });
        });
      });
    });

    test('find a single record with belongsTo link as object { data } (polymorphic)', function () {
      expect(8);

      ajaxResponse([{
        data: {
          type: 'users',
          id: '1',
          attributes: {
            'first-name': 'Yehuda',
            'last-name': 'Katz'
          },
          relationships: {
            company: {
              data: { type: 'development-shops', id: '2' }
            }
          }
        }
      }, {
        data: {
          type: 'development-shop',
          id: '2',
          attributes: {
            name: 'Tilde',
            coffee: true
          }
        }
      }]);

      run(function () {
        store.find('user', 1).then(function (user) {
          equal(passedUrl[0], '/users/1');

          equal(user.get('id'), '1');
          equal(user.get('firstName'), 'Yehuda');
          equal(user.get('lastName'), 'Katz');

          user.get('company').then(function (company) {
            equal(passedUrl[1], '/development-shops/2');

            equal(company.get('id'), '2');
            equal(company.get('name'), 'Tilde');
            equal(company.get('coffee'), true);
          });
        });
      });
    });

    test('find a single record with sideloaded belongsTo link as object { data }', function () {
      expect(7);

      ajaxResponse([{
        data: {
          type: 'post',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          },
          relationships: {
            author: {
              data: { type: 'user', id: '2' }
            }
          }
        },
        included: [{
          type: 'user',
          id: '2',
          attributes: {
            'first-name': 'Yehuda',
            'last-name': 'Katz'
          }
        }]
      }]);

      run(function () {

        store.find('post', 1).then(function (post) {
          equal(passedUrl[0], '/posts/1');

          equal(post.get('id'), '1');
          equal(post.get('title'), 'Ember.js rocks');

          post.get('author').then(function (author) {
            equal(passedUrl.length, 1);

            equal(author.get('id'), '2');
            equal(author.get('firstName'), 'Yehuda');
            equal(author.get('lastName'), 'Katz');
          });
        });
      });
    });

    test('find a single record with hasMany link as object { related }', function () {
      expect(7);

      ajaxResponse([{
        data: {
          type: 'post',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          },
          relationships: {
            comments: {
              links: {
                related: 'http://example.com/post/1/comments'
              }
            }
          }
        }
      }, {
        data: [{
          type: 'comment',
          id: '2',
          attributes: {
            text: 'This is the first comment'
          }
        }, {
          type: 'comment',
          id: '3',
          attributes: {
            text: 'This is the second comment'
          }
        }]
      }]);

      run(function () {
        store.find('post', 1).then(function (post) {
          equal(passedUrl[0], '/posts/1');

          equal(post.get('id'), '1');
          equal(post.get('title'), 'Ember.js rocks');

          post.get('comments').then(function (comments) {
            equal(passedUrl[1], 'http://example.com/post/1/comments');

            equal(comments.get('length'), 2);
            equal(comments.get('firstObject.text'), 'This is the first comment');
            equal(comments.get('lastObject.text'), 'This is the second comment');
          });
        });
      });
    });

    test('find a single record with hasMany link as object { data }', function () {
      expect(8);

      ajaxResponse([{
        data: {
          type: 'post',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          },
          relationships: {
            comments: {
              data: [{ type: 'comment', id: '2' }, { type: 'comment', id: '3' }]
            }
          }
        }
      }, {
        data: {
          type: 'comment',
          id: '2',
          attributes: {
            text: 'This is the first comment'
          }
        }
      }, {
        data: {
          type: 'comment',
          id: '3',
          attributes: {
            text: 'This is the second comment'
          }
        }
      }]);

      run(function () {
        store.find('post', 1).then(function (post) {
          equal(passedUrl[0], '/posts/1');

          equal(post.get('id'), '1');
          equal(post.get('title'), 'Ember.js rocks');

          post.get('comments').then(function (comments) {
            equal(passedUrl[1], '/comments/2');
            equal(passedUrl[2], '/comments/3');

            equal(comments.get('length'), 2);
            equal(comments.get('firstObject.text'), 'This is the first comment');
            equal(comments.get('lastObject.text'), 'This is the second comment');
          });
        });
      });
    });

    test('find a single record with hasMany link as object { data } (polymorphic)', function () {
      expect(9);

      ajaxResponse([{
        data: {
          type: 'user',
          id: '1',
          attributes: {
            'first-name': 'Yehuda',
            'last-name': 'Katz'
          },
          relationships: {
            handles: {
              data: [{ type: 'github-handle', id: '2' }, { type: 'twitter-handle', id: '3' }]
            }
          }
        }
      }, {
        data: {
          type: 'github-handle',
          id: '2',
          attributes: {
            username: 'wycats'
          }
        }
      }, {
        data: {
          type: 'twitter-handle',
          id: '3',
          attributes: {
            nickname: '@wycats'
          }
        }
      }]);

      run(function () {
        store.find('user', 1).then(function (user) {
          equal(passedUrl[0], '/users/1');

          equal(user.get('id'), '1');
          equal(user.get('firstName'), 'Yehuda');
          equal(user.get('lastName'), 'Katz');

          user.get('handles').then(function (handles) {
            equal(passedUrl[1], '/github-handles/2');
            equal(passedUrl[2], '/twitter-handles/3');

            equal(handles.get('length'), 2);
            equal(handles.get('firstObject.username'), 'wycats');
            equal(handles.get('lastObject.nickname'), '@wycats');
          });
        });
      });
    });

    test('find a single record with sideloaded hasMany link as object { data }', function () {
      expect(7);

      ajaxResponse([{
        data: {
          type: 'post',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          },
          relationships: {
            comments: {
              data: [{ type: 'comment', id: '2' }, { type: 'comment', id: '3' }]
            }
          }
        },
        included: [{
          type: 'comment',
          id: '2',
          attributes: {
            text: 'This is the first comment'
          }
        }, {
          type: 'comment',
          id: '3',
          attributes: {
            text: 'This is the second comment'
          }
        }]
      }]);

      run(function () {
        store.find('post', 1).then(function (post) {
          equal(passedUrl[0], '/posts/1');

          equal(post.get('id'), '1');
          equal(post.get('title'), 'Ember.js rocks');

          post.get('comments').then(function (comments) {
            equal(passedUrl.length, 1);

            equal(comments.get('length'), 2);
            equal(comments.get('firstObject.text'), 'This is the first comment');
            equal(comments.get('lastObject.text'), 'This is the second comment');
          });
        });
      });
    });

    test('find a single record with sideloaded hasMany link as object { data } (polymorphic)', function () {
      expect(8);

      ajaxResponse([{
        data: {
          type: 'user',
          id: '1',
          attributes: {
            'first-name': 'Yehuda',
            'last-name': 'Katz'
          },
          relationships: {
            handles: {
              data: [{ type: 'github-handle', id: '2' }, { type: 'twitter-handle', id: '3' }]
            }
          }
        },
        included: [{
          type: 'github-handle',
          id: '2',
          attributes: {
            username: 'wycats'
          }
        }, {
          type: 'twitter-handle',
          id: '3',
          attributes: {
            nickname: '@wycats'
          }
        }]
      }]);

      run(function () {
        store.find('user', 1).then(function (user) {
          equal(passedUrl[0], '/users/1');

          equal(user.get('id'), '1');
          equal(user.get('firstName'), 'Yehuda');
          equal(user.get('lastName'), 'Katz');

          user.get('handles').then(function (handles) {
            equal(passedUrl.length, 1);

            equal(handles.get('length'), 2);
            equal(handles.get('firstObject.username'), 'wycats');
            equal(handles.get('lastObject.nickname'), '@wycats');
          });
        });
      });
    });

    test('create record', function () {
      expect(3);

      ajaxResponse([{
        data: {
          type: 'users',
          id: '3'
        }
      }]);

      run(function () {

        var company = store.push({ data: {
            type: 'company',
            id: '1',
            attributes: {
              name: 'Tilde Inc.'
            }
          } });

        var githubHandle = store.push({ data: {
            type: 'github-handle',
            id: '2',
            attributes: {
              username: 'wycats'
            }
          } });

        var user = store.createRecord('user', {
          firstName: 'Yehuda',
          lastName: 'Katz',
          company: company
        });

        user.get('handles').then(function (handles) {
          handles.addObject(githubHandle);

          user.save().then(function () {
            equal(passedUrl[0], '/users');
            equal(passedVerb[0], 'POST');
            deepEqual(passedHash[0], {
              data: {
                data: {
                  type: 'users',
                  attributes: {
                    'first-name': 'Yehuda',
                    'last-name': 'Katz'
                  },
                  relationships: {
                    company: {
                      data: { type: 'companies', id: '1' }
                    }
                  }
                }
              }
            });
          });
        });
      });
    });

    test('update record', function () {
      expect(3);

      ajaxResponse([{
        data: {
          type: 'users',
          id: '1'
        }
      }]);

      run(function () {
        var user = store.push({ data: {
            type: 'user',
            id: '1',
            attributes: {
              firstName: 'Yehuda',
              lastName: 'Katz'
            }
          } });

        var company = store.push({ data: {
            type: 'company',
            id: '2',
            attributes: {
              name: 'Tilde Inc.'
            }
          } });

        var githubHandle = store.push({ data: {
            type: 'github-handle',
            id: '3',
            attributes: {
              username: 'wycats'
            }
          } });

        user.set('firstName', 'Yehuda!');
        user.set('company', company);

        user.get('handles').then(function (handles) {
          handles.addObject(githubHandle);

          user.save().then(function () {
            equal(passedUrl[0], '/users/1');
            equal(passedVerb[0], 'PATCH');
            deepEqual(passedHash[0], {
              data: {
                data: {
                  type: 'users',
                  id: '1',
                  attributes: {
                    'first-name': 'Yehuda!',
                    'last-name': 'Katz'
                  },
                  relationships: {
                    company: {
                      data: { type: 'companies', id: '2' }
                    }
                  }
                }
              }
            });
          });
        });
      });
    });

    test('update record - serialize hasMany', function () {
      expect(3);

      ajaxResponse([{
        data: {
          type: 'users',
          id: '1'
        }
      }]);

      env.registry.register('serializer:user', DS.JSONAPISerializer.extend({
        attrs: {
          handles: { serialize: true }
        }
      }));

      run(function () {
        var user = store.push({ data: {
            type: 'user',
            id: '1',
            attributes: {
              firstName: 'Yehuda',
              lastName: 'Katz'
            }
          } });

        var githubHandle = store.push({ data: {
            type: 'github-handle',
            id: '2',
            attributes: {
              username: 'wycats'
            }
          } });

        var twitterHandle = store.push({ data: {
            type: 'twitter-handle',
            id: '3',
            attributes: {
              nickname: '@wycats'
            }
          } });

        user.set('firstName', 'Yehuda!');

        user.get('handles').then(function (handles) {
          handles.addObject(githubHandle);
          handles.addObject(twitterHandle);

          user.save().then(function () {
            equal(passedUrl[0], '/users/1');
            equal(passedVerb[0], 'PATCH');
            deepEqual(passedHash[0], {
              data: {
                data: {
                  type: 'users',
                  id: '1',
                  attributes: {
                    'first-name': 'Yehuda!',
                    'last-name': 'Katz'
                  },
                  relationships: {
                    handles: {
                      data: [{ type: 'github-handles', id: '2' }, { type: 'twitter-handles', id: '3' }]
                    }
                  }
                }
              }
            });
          });
        });
      });
    });

    test('fetching a belongsTo relationship link that returns null', function () {
      expect(3);

      ajaxResponse([{
        data: {
          type: 'post',
          id: '1',
          attributes: {
            title: 'Ember.js rocks'
          },
          relationships: {
            author: {
              links: {
                related: 'http://example.com/post/1/author'
              }
            }
          }
        }
      }, {
        data: null
      }]);

      run(function () {
        store.find('post', 1).then(function (post) {
          equal(passedUrl[0], '/posts/1');
          return post.get('author');
        }).then(function (author) {
          equal(passedUrl[1], 'http://example.com/post/1/author');
          equal(author, null);
        });
      });
    });
  }
);


define(
  "ember-data/tests/integration/adapter/queries-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var Person, env, store, adapter;
    var run = Ember.run;

    module('integration/adapter/queries - Queries', {
      setup: function () {
        Person = DS.Model.extend({
          updatedAt: DS.attr('string'),
          name: DS.attr('string'),
          firstName: DS.attr('string'),
          lastName: DS.attr('string')
        });

        env = setupStore({ person: Person });
        store = env.store;
        adapter = env.adapter;
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    test('When a query is made, the adapter should receive a record array it can populate with the results of the query.', function () {
      adapter.query = function (store, type, query, recordArray) {
        equal(type, Person, 'the find method is called with the correct type');

        return Ember.RSVP.resolve([{ id: 1, name: 'Peter Wagenet' }, { id: 2, name: 'Brohuda Katz' }]);
      };

      store.query('person', { page: 1 }).then(async(function (queryResults) {
        equal(get(queryResults, 'length'), 2, 'the record array has a length of 2 after the results are loaded');
        equal(get(queryResults, 'isLoaded'), true, 'the record array\'s `isLoaded` property should be true');

        equal(queryResults.objectAt(0).get('name'), 'Peter Wagenet', 'the first record is \'Peter Wagenet\'');
        equal(queryResults.objectAt(1).get('name'), 'Brohuda Katz', 'the second record is \'Brohuda Katz\'');
      }));
    });
  }
);


define(
  "ember-data/tests/integration/adapter/record-persistence-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var set = Ember.set;
    var attr = DS.attr;
    var Person, env, store;
    var run = Ember.run;

    var all = Ember.RSVP.all;
    var hash = Ember.RSVP.hash;

    function assertClean(promise) {
      return promise.then(async(function (record) {
        equal(record.get("hasDirtyAttributes"), false, "The record is now clean");
        return record;
      }));
    }

    module("integration/adapter/record_persistence - Persisting Records", {
      setup: function () {
        Person = DS.Model.extend({
          updatedAt: attr("string"),
          name: attr("string"),
          firstName: attr("string"),
          lastName: attr("string")
        });
        Person.toString = function () {
          return "Person";
        };

        env = setupStore({ person: Person });
        store = env.store;
      },

      teardown: function () {
        run(env.container, "destroy");
      }
    });

    test("When a store is committed, the adapter's `commit` method should be called with records that have been changed.", function () {
      expect(2);

      env.adapter.updateRecord = function (store, type, snapshot) {
        equal(type, Person, "the type is correct");
        equal(snapshot.record, tom, "the record is correct");

        return run(Ember.RSVP, "resolve");
      };

      run(function () {
        env.store.push("person", { id: 1, name: "Braaaahm Dale" });
      });

      var tom;

      env.store.find("person", 1).then(async(function (person) {
        tom = person;
        set(tom, "name", "Tom Dale");
        tom.save();
      }));
    });

    test("When a store is committed, the adapter's `commit` method should be called with records that have been created.", function () {
      expect(2);
      var tom;

      env.adapter.createRecord = function (store, type, snapshot) {
        equal(type, Person, "the type is correct");
        equal(snapshot.record, tom, "the record is correct");

        return Ember.RSVP.resolve({ id: 1, name: "Tom Dale" });
      };

      run(function () {
        tom = env.store.createRecord("person", { name: "Tom Dale" });
        tom.save();
      });
    });

    test("After a created record has been assigned an ID, finding a record by that ID returns the original record.", function () {
      expect(1);
      var tom;

      env.adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.resolve({ id: 1, name: "Tom Dale" });
      };

      run(function () {
        tom = env.store.createRecord("person", { name: "Tom Dale" });
        tom.save();
      });

      asyncEqual(tom, env.store.find("person", 1), "the retrieved record is the same as the created record");
    });

    test("when a store is committed, the adapter's `commit` method should be called with records that have been deleted.", function () {
      env.adapter.deleteRecord = function (store, type, snapshot) {
        equal(type, Person, "the type is correct");
        equal(snapshot.record, tom, "the record is correct");

        return run(Ember.RSVP, "resolve");
      };

      var tom;

      run(function () {
        env.store.push("person", { id: 1, name: "Tom Dale" });
      });
      env.store.find("person", 1).then(async(function (person) {
        tom = person;
        tom.deleteRecord();
        return tom.save();
      })).then(async(function (tom) {
        equal(get(tom, "isDeleted"), true, "record is marked as deleted");
      }));
    });

    test("An adapter can notify the store that records were updated by calling `didSaveRecords`.", function () {
      expect(6);

      var tom, yehuda;

      env.adapter.updateRecord = function (store, type, snapshot) {
        return Ember.RSVP.resolve();
      };

      run(function () {
        env.store.push("person", { id: 1 });
        env.store.push("person", { id: 2 });
      });

      all([env.store.find("person", 1), env.store.find("person", 2)]).then(async(function (array) {
        tom = array[0];
        yehuda = array[1];

        tom.set("name", "Michael Phelps");
        yehuda.set("name", "Usain Bolt");

        ok(tom.get("hasDirtyAttributes"), "tom is dirty");
        ok(yehuda.get("hasDirtyAttributes"), "yehuda is dirty");

        assertClean(tom.save()).then(async(function (record) {
          equal(record, tom, "The record is correct");
        }));

        assertClean(yehuda.save()).then(async(function (record) {
          equal(record, yehuda, "The record is correct");
        }));
      }));
    });

    test("An adapter can notify the store that records were updated and provide new data by calling `didSaveRecords`.", function () {
      env.adapter.updateRecord = function (store, type, snapshot) {
        if (snapshot.id === "1") {
          return Ember.RSVP.resolve({ id: 1, name: "Tom Dale", updatedAt: "now" });
        } else if (snapshot.id === "2") {
          return Ember.RSVP.resolve({ id: 2, name: "Yehuda Katz", updatedAt: "now!" });
        }
      };

      run(function () {
        env.store.push("person", { id: 1, name: "Braaaahm Dale" });
        env.store.push("person", { id: 2, name: "Gentile Katz" });
      });

      hash({ tom: env.store.find("person", 1), yehuda: env.store.find("person", 2) }).then(async(function (people) {
        people.tom.set("name", "Draaaaaahm Dale");
        people.yehuda.set("name", "Goy Katz");

        return hash({ tom: people.tom.save(), yehuda: people.yehuda.save() });
      })).then(async(function (people) {
        equal(people.tom.get("name"), "Tom Dale", "name attribute should reflect value of hash passed to didSaveRecords");
        equal(people.tom.get("updatedAt"), "now", "updatedAt attribute should reflect value of hash passed to didSaveRecords");
        equal(people.yehuda.get("name"), "Yehuda Katz", "name attribute should reflect value of hash passed to didSaveRecords");
        equal(people.yehuda.get("updatedAt"), "now!", "updatedAt attribute should reflect value of hash passed to didSaveRecords");
      }));
    });

    test("An adapter can notify the store that a record was updated by calling `didSaveRecord`.", function () {
      env.adapter.updateRecord = function (store, type, snapshot) {
        return Ember.RSVP.resolve();
      };

      run(function () {
        store.push("person", { id: 1 });
        store.push("person", { id: 2 });
      });

      hash({ tom: store.find("person", 1), yehuda: store.find("person", 2) }).then(async(function (people) {
        people.tom.set("name", "Tom Dale");
        people.yehuda.set("name", "Yehuda Katz");

        ok(people.tom.get("hasDirtyAttributes"), "tom is dirty");
        ok(people.yehuda.get("hasDirtyAttributes"), "yehuda is dirty");

        assertClean(people.tom.save());
        assertClean(people.yehuda.save());
      }));
    });

    test("An adapter can notify the store that a record was updated and provide new data by calling `didSaveRecord`.", function () {
      env.adapter.updateRecord = function (store, type, snapshot) {
        switch (snapshot.id) {
          case "1":
            return Ember.RSVP.resolve({ id: 1, name: "Tom Dale", updatedAt: "now" });
          case "2":
            return Ember.RSVP.resolve({ id: 2, name: "Yehuda Katz", updatedAt: "now!" });
        }
      };

      run(function () {
        env.store.push("person", { id: 1, name: "Braaaahm Dale" });
        env.store.push("person", { id: 2, name: "Gentile Katz" });
      });

      hash({ tom: store.find("person", 1), yehuda: store.find("person", 2) }).then(async(function (people) {
        people.tom.set("name", "Draaaaaahm Dale");
        people.yehuda.set("name", "Goy Katz");

        return hash({ tom: people.tom.save(), yehuda: people.yehuda.save() });
      })).then(async(function (people) {
        equal(people.tom.get("name"), "Tom Dale", "name attribute should reflect value of hash passed to didSaveRecords");
        equal(people.tom.get("updatedAt"), "now", "updatedAt attribute should reflect value of hash passed to didSaveRecords");
        equal(people.yehuda.get("name"), "Yehuda Katz", "name attribute should reflect value of hash passed to didSaveRecords");
        equal(people.yehuda.get("updatedAt"), "now!", "updatedAt attribute should reflect value of hash passed to didSaveRecords");
      }));
    });

    test("An adapter can notify the store that records were deleted by calling `didSaveRecords`.", function () {
      env.adapter.deleteRecord = function (store, type, snapshot) {
        return Ember.RSVP.resolve();
      };

      run(function () {
        env.store.push("person", { id: 1, name: "Braaaahm Dale" });
        env.store.push("person", { id: 2, name: "Gentile Katz" });
      });

      hash({ tom: store.find("person", 1), yehuda: store.find("person", 2) }).then(async(function (people) {
        people.tom.deleteRecord();
        people.yehuda.deleteRecord();

        assertClean(people.tom.save());
        assertClean(people.yehuda.save());
      }));
    });
  }
);


// Noop
// NOOP
// Noop
// Noop
// NOOP
// NOOP
define(
  "ember-data/tests/integration/adapter/rest-adapter-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, adapter, Post, Comment, SuperUser;
    var passedUrl, passedVerb, passedHash;
    var run = Ember.run;
    var get = Ember.get;

    module("integration/adapter/rest_adapter - REST Adapter", {
      setup: function () {
        Post = DS.Model.extend({
          name: DS.attr("string")
        });

        Post.toString = function () {
          return "Post";
        };

        Comment = DS.Model.extend({
          name: DS.attr("string")
        });

        SuperUser = DS.Model.extend();

        env = setupStore({
          post: Post,
          comment: Comment,
          superUser: SuperUser,
          adapter: DS.RESTAdapter
        });

        store = env.store;
        adapter = env.adapter;

        passedUrl = passedVerb = passedHash = null;
      }
    });

    function ajaxResponse(value) {
      adapter.ajax = function (url, verb, hash) {
        passedUrl = url;
        passedVerb = verb;
        passedHash = hash;

        return run(Ember.RSVP, "resolve", Ember.copy(value, true));
      };
    }

    test("find - basic payload", function () {
      ajaxResponse({ posts: [{ id: 1, name: "Rails is omakase" }] });

      run(store, "find", "post", 1).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "GET");
        equal(passedHash, undefined);

        equal(post.get("id"), "1");
        equal(post.get("name"), "Rails is omakase");
      }));
    });

    test("findRecord - passes buildURL a requestType", function () {
      adapter.buildURL = function (type, id, snapshot, requestType) {
        return "/" + requestType + "/post/" + id;
      };

      ajaxResponse({ posts: [{ id: 1, name: "Rails is omakase" }] });

      run(store, "findRecord", "post", 1).then(async(function (post) {
        equal(passedUrl, "/findRecord/post/1");
      }));
    });

    test("find - basic payload (with legacy singular name)", function () {
      ajaxResponse({ post: { id: 1, name: "Rails is omakase" } });

      run(store, "find", "post", 1).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "GET");
        equal(passedHash, undefined);

        equal(post.get("id"), "1");
        equal(post.get("name"), "Rails is omakase");
      }));
    });

    test("find - payload with sideloaded records of the same type", function () {
      ajaxResponse({
        posts: [{ id: 1, name: "Rails is omakase" }, { id: 2, name: "The Parley Letter" }]
      });

      run(store, "find", "post", 1).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "GET");
        equal(passedHash, undefined);

        equal(post.get("id"), "1");
        equal(post.get("name"), "Rails is omakase");

        var post2 = store.peekRecord("post", 2);
        equal(post2.get("id"), "2");
        equal(post2.get("name"), "The Parley Letter");
      }));
    });

    test("find - payload with sideloaded records of a different type", function () {
      ajaxResponse({
        posts: [{ id: 1, name: "Rails is omakase" }],
        comments: [{ id: 1, name: "FIRST" }]
      });

      run(store, "find", "post", 1).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "GET");
        equal(passedHash, undefined);

        equal(post.get("id"), "1");
        equal(post.get("name"), "Rails is omakase");

        var comment = store.peekRecord("comment", 1);
        equal(comment.get("id"), "1");
        equal(comment.get("name"), "FIRST");
      }));
    });

    test("find - payload with an serializer-specified primary key", function () {
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        primaryKey: "_ID_"
      }));

      ajaxResponse({ posts: [{ "_ID_": 1, name: "Rails is omakase" }] });

      run(store, "find", "post", 1).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "GET");
        equal(passedHash, undefined);

        equal(post.get("id"), "1");
        equal(post.get("name"), "Rails is omakase");
      }));
    });

    test("find - payload with a serializer-specified attribute mapping", function () {
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        attrs: {
          "name": "_NAME_",
          "createdAt": { key: "_CREATED_AT_", someOtherOption: "option" }
        }
      }));

      Post.reopen({
        createdAt: DS.attr("number")
      });

      ajaxResponse({ posts: [{ id: 1, _NAME_: "Rails is omakase", _CREATED_AT_: 2013 }] });

      run(store, "find", "post", 1).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "GET");
        equal(passedHash, undefined);

        equal(post.get("id"), "1");
        equal(post.get("name"), "Rails is omakase");
        equal(post.get("createdAt"), 2013);
      }));
    });

    test("create - an empty payload is a basic success if an id was specified", function () {
      ajaxResponse();
      var post;

      run(function () {
        post = store.createRecord("post", { id: "some-uuid", name: "The Parley Letter" });
        post.save().then(async(function (post) {
          equal(passedUrl, "/posts");
          equal(passedVerb, "POST");
          deepEqual(passedHash.data, { post: { id: "some-uuid", name: "The Parley Letter" } });

          equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
          equal(post.get("name"), "The Parley Letter", "the post was updated");
        }));
      });
    });

    test("create - passes buildURL the requestType", function () {
      adapter.buildURL = function (type, id, snapshot, requestType) {
        return "/post/" + requestType;
      };

      ajaxResponse();
      var post;

      run(function () {
        post = store.createRecord("post", { id: "some-uuid", name: "The Parley Letter" });
        post.save().then(async(function (post) {
          equal(passedUrl, "/post/createRecord");
        }));
      });
    });

    test("create - a payload with a new ID and data applies the updates", function () {
      ajaxResponse({ posts: [{ id: "1", name: "Dat Parley Letter" }] });
      run(function () {
        var post = store.createRecord("post", { name: "The Parley Letter" });

        post.save().then(async(function (post) {
          equal(passedUrl, "/posts");
          equal(passedVerb, "POST");
          deepEqual(passedHash.data, { post: { name: "The Parley Letter" } });

          equal(post.get("id"), "1", "the post has the updated ID");
          equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
          equal(post.get("name"), "Dat Parley Letter", "the post was updated");
        }));
      });
    });

    test("create - a payload with a new ID and data applies the updates (with legacy singular name)", function () {
      var post;
      ajaxResponse({ post: { id: "1", name: "Dat Parley Letter" } });
      run(function () {
        post = store.createRecord("post", { name: "The Parley Letter" });
      });

      run(post, "save").then(async(function (post) {
        equal(passedUrl, "/posts");
        equal(passedVerb, "POST");
        deepEqual(passedHash.data, { post: { name: "The Parley Letter" } });

        equal(post.get("id"), "1", "the post has the updated ID");
        equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
        equal(post.get("name"), "Dat Parley Letter", "the post was updated");
      }));
    });

    test("create - findMany doesn't overwrite owner", function () {
      ajaxResponse({ comment: { id: "1", name: "Dat Parley Letter", post: 1 } });
      var comment;

      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase", comments: [] });
      });
      var post = store.peekRecord("post", 1);

      run(function () {
        comment = store.createRecord("comment", { name: "The Parley Letter" });
      });
      post.get("comments").pushObject(comment);

      equal(comment.get("post"), post, "the post has been set correctly");

      run(function () {
        comment.save().then(async(function (comment) {
          equal(comment.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
          equal(comment.get("name"), "Dat Parley Letter", "the post was updated");
          equal(comment.get("post"), post, "the post is still set");
        }));
      });
    });

    test("create - a serializer's primary key and attributes are consulted when building the payload", function () {
      var post;
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        primaryKey: "_id_",

        attrs: {
          name: "_name_"
        }
      }));

      ajaxResponse();

      run(function () {
        post = store.createRecord("post", { id: "some-uuid", name: "The Parley Letter" });
      });

      run(post, "save").then(async(function (post) {
        deepEqual(passedHash.data, { post: { _id_: "some-uuid", "_name_": "The Parley Letter" } });
      }));
    });

    test("create - a serializer's attributes are consulted when building the payload if no id is pre-defined", function () {
      var post;
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        primarykey: "_id_",

        attrs: {
          name: "_name_"
        }
      }));

      ajaxResponse();

      run(function () {
        post = store.createRecord("post", { name: "The Parley Letter" });

        post.save().then(async(function (post) {
          deepEqual(passedHash.data, { post: { "_name_": "The Parley Letter" } });
        }));
      });
    });

    test("create - a serializer's attribute mapping takes precdence over keyForAttribute when building the payload", function () {
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        attrs: {
          name: "given_name"
        },

        keyForAttribute: function (attr) {
          return attr.toUpperCase();
        }
      }));

      ajaxResponse();

      run(function () {
        var post = store.createRecord("post", { id: "some-uuid", name: "The Parley Letter" });

        post.save().then(async(function (post) {
          deepEqual(passedHash.data, { post: { "given_name": "The Parley Letter", id: "some-uuid" } });
        }));
      });
    });

    test("create - a serializer's attribute mapping takes precedence over keyForRelationship (belongsTo) when building the payload", function () {
      env.registry.register("serializer:comment", DS.RESTSerializer.extend({
        attrs: {
          post: "article"
        },

        keyForRelationship: function (attr, kind) {
          return attr.toUpperCase();
        }
      }));

      ajaxResponse();

      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      run(function () {
        var post = store.createRecord("post", { id: "a-post-id", name: "The Parley Letter" });
        var comment = store.createRecord("comment", { id: "some-uuid", name: "Letters are fun", post: post });

        comment.save().then(async(function (post) {
          deepEqual(passedHash.data, { comment: { article: "a-post-id", id: "some-uuid", name: "Letters are fun" } });
        }));
      });
    });

    test("create - a serializer's attribute mapping takes precedence over keyForRelationship (hasMany) when building the payload", function () {
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        attrs: {
          comments: "opinions"
        },

        keyForRelationship: function (attr, kind) {
          return attr.toUpperCase();
        }
      }));

      ajaxResponse();

      Post.reopen({ comments: DS.hasMany("comment", { async: false }) });

      run(function () {
        var comment = store.createRecord("comment", { id: "a-comment-id", name: "First!" });
        var post = store.createRecord("post", { id: "some-uuid", name: "The Parley Letter", comments: [comment] });

        post.save().then(async(function (post) {
          deepEqual(passedHash.data, { post: { opinions: ["a-comment-id"], id: "some-uuid", name: "The Parley Letter" } });
        }));
      });
    });

    test("create - a record on the many side of a hasMany relationship should update relationships when data is sideloaded", function () {
      expect(3);

      ajaxResponse({
        posts: [{
          id: "1",
          name: "Rails is omakase",
          comments: [1, 2]
        }],
        comments: [{
          id: "2",
          name: "Another Comment",
          post: 1
        }, {
          id: "1",
          name: "Dat Parley Letter",
          post: 1
        }]
        // My API is returning a comment:{} as well as a comments:[{...},...]
        //, comment: {
        //   id: "2",
        //   name: "Another Comment",
        //   post: 1
        // }
      });

      Post.reopen({ comments: DS.hasMany("comment", { async: false }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase", comments: [1] });
        store.push("comment", { id: 1, name: "Dat Parlay Letter", post: 1 });
      });

      var post = store.peekRecord("post", 1);
      var commentCount = post.get("comments.length");
      equal(commentCount, 1, "the post starts life with a comment");

      run(function () {
        var comment = store.createRecord("comment", { name: "Another Comment", post: post });

        comment.save().then(async(function (comment) {
          equal(comment.get("post"), post, "the comment is related to the post");
        }));

        post.reload().then(async(function (post) {
          equal(post.get("comments.length"), 2, "Post comment count has been updated");
        }));
      });
    });

    test("create - sideloaded belongsTo relationships are both marked as loaded", function () {
      expect(4);
      var post;

      Post.reopen({ comment: DS.belongsTo("comment", { async: false }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      run(function () {
        post = store.createRecord("post", { name: "man" });
      });

      ajaxResponse({
        posts: [{ id: 1, comment: 1, name: "marked" }],
        comments: [{ id: 1, post: 1, name: "Comcast is a bargain" }]
      });

      run(function () {
        post.save().then(async(function (record) {
          equal(store.peekRecord("post", 1).get("comment.isLoaded"), true, "post's comment isLoaded (via store)");
          equal(store.peekRecord("comment", 1).get("post.isLoaded"), true, "comment's post isLoaded (via store)");
          equal(record.get("comment.isLoaded"), true, "post's comment isLoaded (via record)");
          equal(record.get("comment.post.isLoaded"), true, "post's comment's post isLoaded (via record)");
        }));
      });
    });

    test("create - response can contain relationships the client doesn't yet know about", function () {
      expect(3); // while records.length is 2, we are getting 4 assertions

      ajaxResponse({
        posts: [{
          id: "1",
          name: "Rails is omakase",
          comments: [2]
        }],
        comments: [{
          id: "2",
          name: "Another Comment",
          post: 1
        }]
      });

      Post.reopen({ comments: DS.hasMany("comment", { async: false }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      var post;
      run(function () {
        post = store.createRecord("post", { name: "Rails is omakase" });
      });

      run(function () {
        post.save().then(async(function (post) {
          equal(post.get("comments.firstObject.post"), post, "the comments are related to the correct post model");
          equal(store.typeMapFor(Post).records.length, 1, "There should only be one post record in the store");

          var postRecords = store.typeMapFor(Post).records;
          for (var i = 0; i < postRecords.length; i++) {
            equal(post, postRecords[i].getRecord(), "The object in the identity map is the same");
          }
        }));
      });
    });

    test("create - relationships are not duplicated", function () {
      var post, comment;

      Post.reopen({ comments: DS.hasMany("comment", { async: false }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      run(function () {
        post = store.createRecord("post", { name: "Tomtomhuda" });
        comment = store.createRecord("comment", { id: 2, name: "Comment title" });
      });

      ajaxResponse({ post: [{ id: 1, name: "Rails is omakase", comments: [] }] });

      run(post, "save").then(async(function (post) {
        equal(post.get("comments.length"), 0, "post has 0 comments");
        post.get("comments").pushObject(comment);
        equal(post.get("comments.length"), 1, "post has 1 comment");

        ajaxResponse({
          post: [{ id: 1, name: "Rails is omakase", comments: [2] }],
          comments: [{ id: 2, name: "Comment title" }]
        });

        return post.save();
      })).then(async(function (post) {
        equal(post.get("comments.length"), 1, "post has 1 comment");
      }));
    });

    test("update - an empty payload is a basic success", function () {
      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse();

        post.set("name", "The Parley Letter");
        return post.save();
      })).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "PUT");
        deepEqual(passedHash.data, { post: { name: "The Parley Letter" } });

        equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
        equal(post.get("name"), "The Parley Letter", "the post was updated");
      }));
    });

    test("update - passes the requestType to buildURL", function () {
      adapter.buildURL = function (type, id, snapshot, requestType) {
        return "/posts/" + id + "/" + requestType;
      };

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse();

        post.set("name", "The Parley Letter");
        return post.save();
      })).then(async(function (post) {
        equal(passedUrl, "/posts/1/updateRecord");
      }));
    });

    test("update - a payload with updates applies the updates", function () {
      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({ posts: [{ id: 1, name: "Dat Parley Letter" }] });

        post.set("name", "The Parley Letter");
        return post.save();
      })).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "PUT");
        deepEqual(passedHash.data, { post: { name: "The Parley Letter" } });

        equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
        equal(post.get("name"), "Dat Parley Letter", "the post was updated");
      }));
    });

    test("update - a payload with updates applies the updates (with legacy singular name)", function () {
      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({ post: { id: 1, name: "Dat Parley Letter" } });

        post.set("name", "The Parley Letter");
        return post.save();
      })).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "PUT");
        deepEqual(passedHash.data, { post: { name: "The Parley Letter" } });

        equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
        equal(post.get("name"), "Dat Parley Letter", "the post was updated");
      }));
    });

    test("update - a payload with sideloaded updates pushes the updates", function () {
      var post;
      ajaxResponse({
        posts: [{ id: 1, name: "Dat Parley Letter" }],
        comments: [{ id: 1, name: "FIRST" }]
      });
      run(function () {
        post = store.createRecord("post", { name: "The Parley Letter" });
        post.save().then(async(function (post) {
          equal(passedUrl, "/posts");
          equal(passedVerb, "POST");
          deepEqual(passedHash.data, { post: { name: "The Parley Letter" } });

          equal(post.get("id"), "1", "the post has the updated ID");
          equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
          equal(post.get("name"), "Dat Parley Letter", "the post was updated");

          var comment = store.peekRecord("comment", 1);
          equal(comment.get("name"), "FIRST", "The comment was sideloaded");
        }));
      });
    });

    test("update - a payload with sideloaded updates pushes the updates", function () {
      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({
          posts: [{ id: 1, name: "Dat Parley Letter" }],
          comments: [{ id: 1, name: "FIRST" }]
        });

        post.set("name", "The Parley Letter");
        return post.save();
      })).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "PUT");
        deepEqual(passedHash.data, { post: { name: "The Parley Letter" } });

        equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
        equal(post.get("name"), "Dat Parley Letter", "the post was updated");

        var comment = store.peekRecord("comment", 1);
        equal(comment.get("name"), "FIRST", "The comment was sideloaded");
      }));
    });

    test("update - a serializer's primary key and attributes are consulted when building the payload", function () {
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        primaryKey: "_id_",

        attrs: {
          name: "_name_"
        }
      }));

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });
      ajaxResponse();

      store.find("post", 1).then(async(function (post) {
        post.set("name", "The Parley Letter");
        return post.save();
      })).then(async(function (post) {
        deepEqual(passedHash.data, { post: { "_name_": "The Parley Letter" } });
      }));
    });

    test("update - hasMany relationships faithfully reflect simultaneous adds and removes", function () {
      Post.reopen({ comments: DS.hasMany("comment", { async: false }) });
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });

      run(function () {
        store.push("post", { id: 1, name: "Not everyone uses Rails", comments: [1] });
        store.push("comment", { id: 1, name: "Rails is omakase" });
        store.push("comment", { id: 2, name: "Yes. Yes it is." });
      });

      ajaxResponse({
        posts: { id: 1, name: "Not everyone uses Rails", comments: [2] }
      });

      store.find("comment", 2).then(async(function () {
        return store.find("post", 1);
      })).then(async(function (post) {
        var newComment = store.peekRecord("comment", 2);
        var comments = post.get("comments");

        // Replace the comment with a new one
        comments.popObject();
        comments.pushObject(newComment);

        return post.save();
      })).then(async(function (post) {
        equal(post.get("comments.length"), 1, "the post has the correct number of comments");
        equal(post.get("comments.firstObject.name"), "Yes. Yes it is.", "the post has the correct comment");
      }));
    });

    test("delete - an empty payload is a basic success", function () {
      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse();

        post.deleteRecord();
        return post.save();
      })).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "DELETE");
        equal(passedHash, undefined);

        equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
        equal(post.get("isDeleted"), true, "the post is now deleted");
      }));
    });

    test("delete - passes the requestType to buildURL", function () {
      adapter.buildURL = function (type, id, snapshot, requestType) {
        return "/posts/" + id + "/" + requestType;
      };

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse();

        post.deleteRecord();
        return post.save();
      })).then(async(function (post) {
        equal(passedUrl, "/posts/1/deleteRecord");
      }));
    });

    test("delete - a payload with sideloaded updates pushes the updates", function () {
      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({ comments: [{ id: 1, name: "FIRST" }] });

        post.deleteRecord();
        return post.save();
      })).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "DELETE");
        equal(passedHash, undefined);

        equal(post.get("hasDirtyAttributes"), false, "the post isn't dirty anymore");
        equal(post.get("isDeleted"), true, "the post is now deleted");

        var comment = store.peekRecord("comment", 1);
        equal(comment.get("name"), "FIRST", "The comment was sideloaded");
      }));
    });

    test("delete - a payload with sidloaded updates pushes the updates when the original record is omitted", function () {
      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase" });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({ posts: [{ id: 2, name: "The Parley Letter" }] });

        post.deleteRecord();
        return post.save();
      })).then(async(function (post) {
        equal(passedUrl, "/posts/1");
        equal(passedVerb, "DELETE");
        equal(passedHash, undefined);

        equal(post.get("hasDirtyAttributes"), false, "the original post isn't dirty anymore");
        equal(post.get("isDeleted"), true, "the original post is now deleted");

        var newPost = store.peekRecord("post", 2);
        equal(newPost.get("name"), "The Parley Letter", "The new post was added to the store");
      }));
    });

    test("delete - deleting a newly created record should not throw an error", function () {
      var post;
      run(function () {
        post = store.createRecord("post");
      });

      run(function () {
        post.deleteRecord();
        post.save().then(async(function (post) {
          equal(passedUrl, null, "There is no ajax call to delete a record that has never been saved.");
          equal(passedVerb, null, "There is no ajax call to delete a record that has never been saved.");
          equal(passedHash, null, "There is no ajax call to delete a record that has never been saved.");

          equal(post.get("isDeleted"), true, "the post is now deleted");
          equal(post.get("isError"), false, "the post is not an error");
        }));
      });
    });

    test("findAll - returning an array populates the array", function () {
      ajaxResponse({
        posts: [{ id: 1, name: "Rails is omakase" }, { id: 2, name: "The Parley Letter" }]
      });

      store.findAll("post").then(async(function (posts) {
        equal(passedUrl, "/posts");
        equal(passedVerb, "GET");
        equal(passedHash.data, undefined);

        var post1 = store.peekRecord("post", 1);
        var post2 = store.peekRecord("post", 2);

        deepEqual(post1.getProperties("id", "name"), { id: "1", name: "Rails is omakase" }, "Post 1 is loaded");

        deepEqual(post2.getProperties("id", "name"), { id: "2", name: "The Parley Letter" }, "Post 2 is loaded");

        equal(posts.get("length"), 2, "The posts are in the array");
        equal(posts.get("isLoaded"), true, "The RecordArray is loaded");
        deepEqual(posts.toArray(), [post1, post2], "The correct records are in the array");
      }));
    });

    test("findAll - passes buildURL the requestType", function () {
      adapter.buildURL = function (type, id, snapshot, requestType) {
        return "/" + requestType + "/posts";
      };

      ajaxResponse({
        posts: [{ id: 1, name: "Rails is omakase" }, { id: 2, name: "The Parley Letter" }]
      });

      store.findAll("post").then(async(function (posts) {
        equal(passedUrl, "/findAll/posts");
      }));
    });

    test("findAll - returning sideloaded data loads the data", function () {
      ajaxResponse({
        posts: [{ id: 1, name: "Rails is omakase" }, { id: 2, name: "The Parley Letter" }],
        comments: [{ id: 1, name: "FIRST" }] });

      store.findAll("post").then(async(function (posts) {
        var comment = store.peekRecord("comment", 1);

        deepEqual(comment.getProperties("id", "name"), { id: "1", name: "FIRST" });
      }));
    });

    test("findAll - data is normalized through custom serializers", function () {
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        primaryKey: "_ID_",
        attrs: { name: "_NAME_" }
      }));

      ajaxResponse({
        posts: [{ _ID_: 1, _NAME_: "Rails is omakase" }, { _ID_: 2, _NAME_: "The Parley Letter" }]
      });

      store.findAll("post").then(async(function (posts) {
        var post1 = store.peekRecord("post", 1);
        var post2 = store.peekRecord("post", 2);

        deepEqual(post1.getProperties("id", "name"), { id: "1", name: "Rails is omakase" }, "Post 1 is loaded");
        deepEqual(post2.getProperties("id", "name"), { id: "2", name: "The Parley Letter" }, "Post 2 is loaded");

        equal(posts.get("length"), 2, "The posts are in the array");
        equal(posts.get("isLoaded"), true, "The RecordArray is loaded");
        deepEqual(posts.toArray(), [post1, post2], "The correct records are in the array");
      }));
    });

    test("findAll - since token is passed to the adapter", function () {
      ajaxResponse({
        meta: { since: "later" },
        posts: [{ id: 1, name: "Rails is omakase" }, { id: 2, name: "The Parley Letter" }]
      });

      store.setMetadataFor("post", { since: "now" });

      store.findAll("post").then(async(function (posts) {
        equal(passedUrl, "/posts");
        equal(passedVerb, "GET");
        equal(store.typeMapFor(Post).metadata.since, "later");
        deepEqual(passedHash.data, { since: "now" });
      }));
    });

    test("metadata is accessible", function () {
      ajaxResponse({
        meta: { offset: 5 },
        posts: [{ id: 1, name: "Rails is very expensive sushi" }]
      });

      store.findAll("post").then(async(function (posts) {
        equal(store.metadataFor("post").offset, 5, "Metadata can be accessed with metadataFor.");
      }));
    });

    test("findQuery - if `sortQueryParams` option is not provided, query params are sorted alphabetically", function () {
      adapter.ajax = function (url, verb, hash) {
        passedUrl = url;
        passedVerb = verb;
        passedHash = hash;

        deepEqual(Object.keys(hash.data), ["in", "order", "params", "wrong"], "query params are received in alphabetical order");

        return run(Ember.RSVP, "resolve", { posts: [{ id: 1, name: "Rails is very expensive sushi" }] });
      };

      store.query("post", { "params": 1, "in": 2, "wrong": 3, "order": 4 }).then(async(function () {}));
    });

    test("findQuery - passes buildURL the requestType", function () {
      adapter.buildURL = function (type, id, snapshot, requestType) {
        return "/" + requestType + "/posts";
      };

      adapter.ajax = function (url, verb, hash) {
        equal(url, "/query/posts");

        return run(Ember.RSVP, "resolve", { posts: [{ id: 1, name: "Rails is very expensive sushi" }] });
      };

      store.query("post", { "params": 1, "in": 2, "wrong": 3, "order": 4 }).then(async(function () {}));
    });

    test("findQuery - if `sortQueryParams` is falsey, query params are not sorted at all", function () {
      adapter.ajax = function (url, verb, hash) {
        passedUrl = url;
        passedVerb = verb;
        passedHash = hash;

        deepEqual(Object.keys(hash.data), ["params", "in", "wrong", "order"], "query params are received in their original order");

        return run(Ember.RSVP, "resolve", { posts: [{ id: 1, name: "Rails is very expensive sushi" }] });
      };

      adapter.sortQueryParams = null;

      store.query("post", { "params": 1, "in": 2, "wrong": 3, "order": 4 }).then(async(function () {}));
    });

    test("findQuery - if `sortQueryParams` is a custom function, query params passed through that function", function () {
      adapter.ajax = function (url, verb, hash) {
        passedUrl = url;
        passedVerb = verb;
        passedHash = hash;

        deepEqual(Object.keys(hash.data), ["wrong", "params", "order", "in"], "query params are received in reverse alphabetical order");

        return run(Ember.RSVP, "resolve", { posts: [{ id: 1, name: "Rails is very expensive sushi" }] });
      };

      adapter.sortQueryParams = function (obj) {
        var sortedKeys = Object.keys(obj).sort().reverse();
        var len = sortedKeys.length;
        var newQueryParams = {};

        for (var i = 0; i < len; i++) {
          newQueryParams[sortedKeys[i]] = obj[sortedKeys[i]];
        }
        return newQueryParams;
      };

      store.query("post", { "params": 1, "in": 2, "wrong": 3, "order": 4 }).then(async(function () {}));
    });

    test("findQuery - payload 'meta' is accessible on the record array", function () {
      ajaxResponse({
        meta: { offset: 5 },
        posts: [{ id: 1, name: "Rails is very expensive sushi" }]
      });

      store.query("post", { page: 2 }).then(async(function (posts) {
        equal(posts.get("meta.offset"), 5, "Reponse metadata can be accessed with recordArray.meta");
      }));
    });

    test("findQuery - each record array can have it's own meta object", function () {
      ajaxResponse({
        meta: { offset: 5 },
        posts: [{ id: 1, name: "Rails is very expensive sushi" }]
      });

      store.query("post", { page: 2 }).then(async(function (posts) {
        equal(posts.get("meta.offset"), 5, "Reponse metadata can be accessed with recordArray.meta");
        ajaxResponse({
          meta: { offset: 1 },
          posts: [{ id: 1, name: "Rails is very expensive sushi" }]
        });
        store.query("post", { page: 1 }).then(async(function (newPosts) {
          equal(newPosts.get("meta.offset"), 1, "new array has correct metadata");
          equal(posts.get("meta.offset"), 5, "metadata on the old array hasnt been clobbered");
        }));
      }));
    });

    test("findQuery - returning an array populates the array", function () {
      ajaxResponse({
        posts: [{ id: 1, name: "Rails is omakase" }, { id: 2, name: "The Parley Letter" }]
      });

      store.query("post", { page: 1 }).then(async(function (posts) {
        equal(passedUrl, "/posts");
        equal(passedVerb, "GET");
        deepEqual(passedHash.data, { page: 1 });

        var post1 = store.peekRecord("post", 1);
        var post2 = store.peekRecord("post", 2);

        deepEqual(post1.getProperties("id", "name"), { id: "1", name: "Rails is omakase" }, "Post 1 is loaded");
        deepEqual(post2.getProperties("id", "name"), { id: "2", name: "The Parley Letter" }, "Post 2 is loaded");

        equal(posts.get("length"), 2, "The posts are in the array");
        equal(posts.get("isLoaded"), true, "The RecordArray is loaded");
        deepEqual(posts.toArray(), [post1, post2], "The correct records are in the array");
      }));
    });

    test("findQuery - returning sideloaded data loads the data", function () {
      ajaxResponse({
        posts: [{ id: 1, name: "Rails is omakase" }, { id: 2, name: "The Parley Letter" }],
        comments: [{ id: 1, name: "FIRST" }]
      });

      store.query("post", { page: 1 }).then(async(function (posts) {
        var comment = store.peekRecord("comment", 1);

        deepEqual(comment.getProperties("id", "name"), { id: "1", name: "FIRST" });
      }));
    });

    test("findQuery - data is normalized through custom serializers", function () {
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        primaryKey: "_ID_",
        attrs: { name: "_NAME_" }
      }));

      ajaxResponse({
        posts: [{ _ID_: 1, _NAME_: "Rails is omakase" }, { _ID_: 2, _NAME_: "The Parley Letter" }]
      });

      store.query("post", { page: 1 }).then(async(function (posts) {
        var post1 = store.peekRecord("post", 1);
        var post2 = store.peekRecord("post", 2);

        deepEqual(post1.getProperties("id", "name"), { id: "1", name: "Rails is omakase" }, "Post 1 is loaded");

        deepEqual(post2.getProperties("id", "name"), { id: "2", name: "The Parley Letter" }, "Post 2 is loaded");

        equal(posts.get("length"), 2, "The posts are in the array");
        equal(posts.get("isLoaded"), true, "The RecordArray is loaded");
        deepEqual(posts.toArray(), [post1, post2], "The correct records are in the array");
      }));
    });

    test("findMany - findMany uses a correct URL to access the records", function () {
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      adapter.coalesceFindRequests = true;

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase", comments: [1, 2, 3] });
      });

      var post = store.peekRecord("post", 1);
      ajaxResponse({
        comments: [{ id: 1, name: "FIRST" }, { id: 2, name: "Rails is unagi" }, { id: 3, name: "What is omakase?" }]
      });
      run(post, "get", "comments").then(async(function (comments) {
        equal(passedUrl, "/comments");
        deepEqual(passedHash, { data: { ids: ["1", "2", "3"] } });
      }));
    });

    test("findMany - passes buildURL the requestType", function () {
      adapter.buildURL = function (type, id, snapshot, requestType) {
        return "/" + requestType + "/" + type;
      };

      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      adapter.coalesceFindRequests = true;

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase", comments: [1, 2, 3] });
      });

      var post = store.peekRecord("post", 1);
      ajaxResponse({
        comments: [{ id: 1, name: "FIRST" }, { id: 2, name: "Rails is unagi" }, { id: 3, name: "What is omakase?" }]
      });
      run(post, "get", "comments").then(async(function (comments) {
        equal(passedUrl, "/findMany/comment");
      }));
    });

    test("findMany - findMany does not coalesce by default", function () {
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase", comments: [1, 2, 3] });
      });

      var post = store.peekRecord("post", 1);
      //It's still ok to return this even without coalescing  because RESTSerializer supports sideloading
      ajaxResponse({
        comments: [{ id: 1, name: "FIRST" }, { id: 2, name: "Rails is unagi" }, { id: 3, name: "What is omakase?" }]
      });
      run(post, "get", "comments").then(async(function (comments) {
        equal(passedUrl, "/comments/3");
        equal(passedHash, null);
      }));
    });

    test("findMany - returning an array populates the array", function () {
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      adapter.coalesceFindRequests = true;

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase", comments: [1, 2, 3] });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({
          comments: [{ id: 1, name: "FIRST" }, { id: 2, name: "Rails is unagi" }, { id: 3, name: "What is omakase?" }]
        });

        return post.get("comments");
      })).then(async(function (comments) {
        var comment1 = store.peekRecord("comment", 1);
        var comment2 = store.peekRecord("comment", 2);
        var comment3 = store.peekRecord("comment", 3);

        deepEqual(comment1.getProperties("id", "name"), { id: "1", name: "FIRST" });
        deepEqual(comment2.getProperties("id", "name"), { id: "2", name: "Rails is unagi" });
        deepEqual(comment3.getProperties("id", "name"), { id: "3", name: "What is omakase?" });

        deepEqual(comments.toArray(), [comment1, comment2, comment3], "The correct records are in the array");
      }));
    });

    test("findMany - returning sideloaded data loads the data", function () {
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      adapter.coalesceFindRequests = true;

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase", comments: [1, 2, 3] });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({
          comments: [{ id: 1, name: "FIRST" }, { id: 2, name: "Rails is unagi" }, { id: 3, name: "What is omakase?" }, { id: 4, name: "Unrelated comment" }],
          posts: [{ id: 2, name: "The Parley Letter" }]
        });

        return post.get("comments");
      })).then(async(function (comments) {
        var comment1 = store.peekRecord("comment", 1);
        var comment2 = store.peekRecord("comment", 2);
        var comment3 = store.peekRecord("comment", 3);
        var comment4 = store.peekRecord("comment", 4);
        var post2 = store.peekRecord("post", 2);

        deepEqual(comments.toArray(), [comment1, comment2, comment3], "The correct records are in the array");

        deepEqual(comment4.getProperties("id", "name"), { id: "4", name: "Unrelated comment" });
        deepEqual(post2.getProperties("id", "name"), { id: "2", name: "The Parley Letter" });
      }));
    });

    test("findMany - a custom serializer is used if present", function () {
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        primaryKey: "_ID_",
        attrs: { name: "_NAME_" }
      }));

      env.registry.register("serializer:comment", DS.RESTSerializer.extend({
        primaryKey: "_ID_",
        attrs: { name: "_NAME_" }
      }));

      adapter.coalesceFindRequests = true;
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });

      run(function () {
        store.push("post", { id: 1, name: "Rails is omakase", comments: [1, 2, 3] });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({
          comments: [{ _ID_: 1, _NAME_: "FIRST" }, { _ID_: 2, _NAME_: "Rails is unagi" }, { _ID_: 3, _NAME_: "What is omakase?" }]
        });

        return post.get("comments");
      })).then(async(function (comments) {
        var comment1 = store.peekRecord("comment", 1);
        var comment2 = store.peekRecord("comment", 2);
        var comment3 = store.peekRecord("comment", 3);

        deepEqual(comment1.getProperties("id", "name"), { id: "1", name: "FIRST" });
        deepEqual(comment2.getProperties("id", "name"), { id: "2", name: "Rails is unagi" });
        deepEqual(comment3.getProperties("id", "name"), { id: "3", name: "What is omakase?" });

        deepEqual(comments.toArray(), [comment1, comment2, comment3], "The correct records are in the array");
      }));
    });

    test("findHasMany - returning an array populates the array", function () {
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });

      run(function () {
        store.push("post", {
          id: 1,
          name: "Rails is omakase",
          links: { comments: "/posts/1/comments" }
        });
      });

      run(store, "find", "post", "1").then(async(function (post) {
        ajaxResponse({
          comments: [{ id: 1, name: "FIRST" }, { id: 2, name: "Rails is unagi" }, { id: 3, name: "What is omakase?" }]
        });

        return post.get("comments");
      })).then(async(function (comments) {
        equal(passedUrl, "/posts/1/comments");
        equal(passedVerb, "GET");
        equal(passedHash, undefined);

        var comment1 = store.peekRecord("comment", 1);
        var comment2 = store.peekRecord("comment", 2);
        var comment3 = store.peekRecord("comment", 3);

        deepEqual(comment1.getProperties("id", "name"), { id: "1", name: "FIRST" });
        deepEqual(comment2.getProperties("id", "name"), { id: "2", name: "Rails is unagi" });
        deepEqual(comment3.getProperties("id", "name"), { id: "3", name: "What is omakase?" });

        deepEqual(comments.toArray(), [comment1, comment2, comment3], "The correct records are in the array");
      }));
    });

    test("findHasMany - passes buildURL the requestType", function () {
      adapter.buildURL = function (type, id, snapshot, requestType) {
        equal(requestType, "findHasMany");
      };

      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });

      run(function () {
        store.push("post", {
          id: 1,
          name: "Rails is omakase",
          links: { comments: "/posts/1/comments" }
        });
      });

      run(store, "find", "post", "1").then(async(function (post) {
        ajaxResponse({
          comments: [{ id: 1, name: "FIRST" }, { id: 2, name: "Rails is unagi" }, { id: 3, name: "What is omakase?" }]
        });

        return post.get("comments");
      })).then(async(function (comments) {}));
    });

    test("findMany - returning sideloaded data loads the data", function () {
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      adapter.coalesceFindRequests = true;

      run(function () {
        store.push("post", {
          id: 1,
          name: "Rails is omakase",
          links: { comments: "/posts/1/comments" }
        });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({
          comments: [{ id: 1, name: "FIRST" }, { id: 2, name: "Rails is unagi" }, { id: 3, name: "What is omakase?" }],
          posts: [{ id: 2, name: "The Parley Letter" }]
        });

        return post.get("comments");
      })).then(async(function (comments) {
        var comment1 = store.peekRecord("comment", 1);
        var comment2 = store.peekRecord("comment", 2);
        var comment3 = store.peekRecord("comment", 3);
        var post2 = store.peekRecord("post", 2);

        deepEqual(comments.toArray(), [comment1, comment2, comment3], "The correct records are in the array");

        deepEqual(post2.getProperties("id", "name"), { id: "2", name: "The Parley Letter" });
      }));
    });

    test("findMany - a custom serializer is used if present", function () {
      env.registry.register("serializer:post", DS.RESTSerializer.extend({
        primaryKey: "_ID_",
        attrs: { name: "_NAME_" }
      }));

      env.registry.register("serializer:comment", DS.RESTSerializer.extend({
        primaryKey: "_ID_",
        attrs: { name: "_NAME_" }
      }));

      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });

      run(function () {
        store.push("post", {
          id: 1,
          name: "Rails is omakase",
          links: { comments: "/posts/1/comments" }
        });
      });

      store.find("post", 1).then(async(function (post) {
        ajaxResponse({
          comments: [{ _ID_: 1, _NAME_: "FIRST" }, { _ID_: 2, _NAME_: "Rails is unagi" }, { _ID_: 3, _NAME_: "What is omakase?" }]
        });
        return post.get("comments");
      })).then(async(function (comments) {
        var comment1 = store.peekRecord("comment", 1);
        var comment2 = store.peekRecord("comment", 2);
        var comment3 = store.peekRecord("comment", 3);

        deepEqual(comment1.getProperties("id", "name"), { id: "1", name: "FIRST" });
        deepEqual(comment2.getProperties("id", "name"), { id: "2", name: "Rails is unagi" });
        deepEqual(comment3.getProperties("id", "name"), { id: "3", name: "What is omakase?" });

        deepEqual(comments.toArray(), [comment1, comment2, comment3], "The correct records are in the array");
      }));
    });

    test("findBelongsTo - passes buildURL the requestType", function () {
      adapter.buildURL = function (type, id, snapshot, requestType) {
        equal(requestType, "findBelongsTo");
      };

      Comment.reopen({ post: DS.belongsTo("post", { async: true }) });

      run(function () {
        store.push("comment", {
          id: 1, name: "FIRST",
          links: { post: "/posts/1" }
        });
      });

      run(store, "find", "comment", 1).then(async(function (comment) {
        ajaxResponse({ post: { id: 1, name: "Rails is omakase" } });
        return comment.get("post");
      })).then(async(function (post) {}));
    });

    test("coalesceFindRequests warns if the expected records are not returned in the coalesced request", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });

      adapter.coalesceFindRequests = true;

      ajaxResponse({ comments: [{ id: 1 }] });
      var post;

      warns(function () {
        run(function () {
          post = store.push("post", { id: 2, comments: [1, 2, 3] });
          post.get("comments");
        });
      }, /expected to find records with the following ids in the adapter response but they were missing: \[2,3\]/);
    });

    test("groupRecordsForFindMany groups records based on their url", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      adapter.coalesceFindRequests = true;

      adapter.buildURL = function (type, id, snapshot) {
        if (id === "1") {
          return "/comments/1";
        } else {
          return "/other_comments/" + id;
        }
      };

      adapter.findRecord = function (store, type, id, snapshot) {
        equal(id, "1");
        return Ember.RSVP.resolve({ comments: { id: 1 } });
      };

      adapter.findMany = function (store, type, ids, snapshots) {
        deepEqual(ids, ["2", "3"]);
        return Ember.RSVP.resolve({ comments: [{ id: 2 }, { id: 3 }] });
      };

      var post;
      run(function () {
        post = store.push("post", { id: 2, comments: [1, 2, 3] });
      });

      run(function () {
        post.get("comments");
      });
    });

    test("groupRecordsForFindMany groups records correctly when singular URLs are encoded as query params", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });
      adapter.coalesceFindRequests = true;

      adapter.buildURL = function (type, id, snapshot) {
        if (id === "1") {
          return "/comments?id=1";
        } else {
          return "/other_comments?id=" + id;
        }
      };

      adapter.findRecord = function (store, type, id, snapshot) {
        equal(id, "1");
        return Ember.RSVP.resolve({ comments: { id: 1 } });
      };

      adapter.findMany = function (store, type, ids, snapshots) {
        deepEqual(ids, ["2", "3"]);
        return Ember.RSVP.resolve({ comments: [{ id: 2 }, { id: 3 }] });
      };
      var post;

      run(function () {
        post = store.push("post", { id: 2, comments: [1, 2, 3] });
      });

      run(function () {
        post.get("comments");
      });
    });

    test("normalizeKey - to set up _ids and _id", function () {
      env.registry.register("serializer:application", DS.RESTSerializer.extend({
        keyForAttribute: function (attr) {
          return Ember.String.underscore(attr);
        },

        keyForBelongsTo: function (belongsTo) {},

        keyForRelationship: function (rel, kind) {
          if (kind === "belongsTo") {
            var underscored = Ember.String.underscore(rel);
            return underscored + "_id";
          } else {
            var singular = Ember.String.singularize(rel);
            return Ember.String.underscore(singular) + "_ids";
          }
        }
      }));

      env.registry.register("model:post", DS.Model.extend({
        name: DS.attr(),
        authorName: DS.attr(),
        author: DS.belongsTo("user", { async: false }),
        comments: DS.hasMany("comment", { async: false })
      }));

      env.registry.register("model:user", DS.Model.extend({
        createdAt: DS.attr(),
        name: DS.attr()
      }));

      env.registry.register("model:comment", DS.Model.extend({
        body: DS.attr()
      }));

      ajaxResponse({
        posts: [{
          id: "1",
          name: "Rails is omakase",
          author_name: "@d2h",
          author_id: "1",
          comment_ids: ["1", "2"]
        }],

        users: [{
          id: "1",
          name: "D2H"
        }],

        comments: [{
          id: "1",
          body: "Rails is unagi"
        }, {
          id: "2",
          body: "What is omakase?"
        }]
      });

      run(function () {
        store.find("post", 1).then(async(function (post) {
          equal(post.get("authorName"), "@d2h");
          equal(post.get("author.name"), "D2H");
          deepEqual(post.get("comments").mapBy("body"), ["Rails is unagi", "What is omakase?"]);
        }));
      });
    });

    test("groupRecordsForFindMany splits up calls for large ids", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });

      expect(2);

      function repeatChar(character, n) {
        return new Array(n + 1).join(character);
      }

      var a2000 = repeatChar("a", 2000);
      var b2000 = repeatChar("b", 2000);
      var post;
      run(function () {
        post = store.push("post", { id: 1, comments: [a2000, b2000] });
      });

      adapter.coalesceFindRequests = true;

      adapter.findRecord = function (store, type, id, snapshot) {
        if (id === a2000 || id === b2000) {
          ok(true, "Found " + id);
        }

        return Ember.RSVP.resolve({ comments: { id: id } });
      };

      adapter.findMany = function (store, type, ids, snapshots) {
        ok(false, "findMany should not be called - we expect 2 calls to find for a2000 and b2000");
        return Ember.RSVP.reject();
      };

      run(function () {
        post.get("comments");
      });
    });

    test("groupRecordsForFindMany groups calls for small ids", function () {
      Comment.reopen({ post: DS.belongsTo("post", { async: false }) });
      Post.reopen({ comments: DS.hasMany("comment", { async: true }) });

      expect(1);

      function repeatChar(character, n) {
        return new Array(n + 1).join(character);
      }

      var a100 = repeatChar("a", 100);
      var b100 = repeatChar("b", 100);
      var post;

      run(function () {
        post = store.push("post", { id: 1, comments: [a100, b100] });
      });

      adapter.coalesceFindRequests = true;

      adapter.findRecord = function (store, type, id, snapshot) {
        ok(false, "find should not be called - we expect 1 call to findMany for a100 and b100");
        return Ember.RSVP.reject();
      };

      adapter.findMany = function (store, type, ids, snapshots) {
        deepEqual(ids, [a100, b100]);
        return Ember.RSVP.resolve({ comments: [{ id: a100 }, { id: b100 }] });
      };

      run(function () {
        post.get("comments");
      });
    });

    test("calls adapter.handleResponse with the jqXHR and json", function () {
      expect(2);
      var originalAjax = Ember.$.ajax;
      var jqXHR = {
        status: 200,
        getAllResponseHeaders: function () {
          return "";
        }
      };
      var data = {
        post: {
          id: "1",
          name: "Docker is amazing"
        }
      };

      Ember.$.ajax = function (hash) {
        hash.success(data, "ok", jqXHR);
      };

      adapter.handleResponse = function (status, headers, json) {
        deepEqual(status, 200);
        deepEqual(json, data);
        return json;
      };

      try {
        run(function () {
          store.find("post", "1");
        });
      } finally {
        Ember.$.ajax = originalAjax;
      }
    });

    test("calls handleResponse with jqXHR, jqXHR.responseText", function () {
      expect(3);
      var originalAjax = Ember.$.ajax;
      var jqXHR = {
        status: 400,
        responseText: "Nope lol",
        getAllResponseHeaders: function () {
          return "";
        }
      };

      Ember.$.ajax = function (hash) {
        hash.error(jqXHR, jqXHR.responseText, "Bad Request");
      };

      adapter.handleResponse = function (status, headers, json) {
        deepEqual(status, 400);
        deepEqual(json, jqXHR.responseText);
        return new DS.AdapterError("nope!");
      };

      try {
        run(function () {
          store.find("post", "1")["catch"](function (err) {
            ok(err, "promise rejected");
          });
        });
      } finally {
        Ember.$.ajax = originalAjax;
      }
    });

    test("rejects promise if DS.AdapterError is returned from adapter.handleResponse", function () {
      expect(3);
      var originalAjax = Ember.$.ajax;
      var jqXHR = {
        getAllResponseHeaders: function () {
          return "";
        }
      };
      var data = {
        something: "is invalid"
      };

      Ember.$.ajax = function (hash) {
        hash.success(data, "ok", jqXHR);
      };

      adapter.handleResponse = function (status, headers, json) {
        ok(true, "handleResponse should be called");
        return new DS.AdapterError(json);
      };

      Ember.run(function () {
        store.find("post", "1").then(null, function (reason) {
          ok(true, "promise should be rejected");
          ok(reason instanceof DS.AdapterError, "reason should be an instance of DS.AdapterError");
        });
      });

      Ember.$.ajax = originalAjax;
    });

    test("on error appends errorThrown for sanity", function () {
      expect(2);

      var originalAjax = Ember.$.ajax;
      var jqXHR = {
        responseText: "Nope lol",
        getAllResponseHeaders: function () {
          return "";
        }
      };

      var errorThrown = new Error("nope!");

      Ember.$.ajax = function (hash) {
        hash.error(jqXHR, jqXHR.responseText, errorThrown);
      };

      adapter.handleResponse = function (status, headers, payload) {
        ok(false);
      };

      try {
        run(function () {
          store.find("post", "1")["catch"](function (err) {
            equal(err, errorThrown);
            ok(err, "promise rejected");
          });
        });
      } finally {
        Ember.$.ajax = originalAjax;
      }
    });

    test("on error wraps the error string in an DS.AdapterError object", function () {
      expect(2);

      var originalAjax = Ember.$.ajax;
      var jqXHR = {
        responseText: "",
        getAllResponseHeaders: function () {
          return "";
        }
      };

      var errorThrown = "nope!";

      Ember.$.ajax = function (hash) {
        hash.error(jqXHR, "error", errorThrown);
      };

      try {
        run(function () {
          store.find("post", "1")["catch"](function (err) {
            equal(err.errors[0].detail, errorThrown);
            ok(err, "promise rejected");
          });
        });
      } finally {
        Ember.$.ajax = originalAjax;
      }
    });

    test("findAll resolves with a collection of DS.Models, not DS.InternalModels", function () {
      expect(4);

      ajaxResponse({
        posts: [{
          id: 1,
          name: "dhh lol"
        }, {
          id: 2,
          name: "james mickens is rad"
        }, {
          id: 3,
          name: "in the name of love"
        }]
      });

      run(function () {
        store.findAll("post").then(async(function (posts) {
          equal(get(posts, "length"), 3);
          posts.forEach(function (post) {
            return ok(post instanceof DS.Model);
          });
        }));
      });
    });

    test("create - sideloaded records are pushed to the store", function () {
      Post.reopen({
        comments: DS.hasMany("comment")
      });

      ajaxResponse({
        post: {
          id: 1,
          name: "The Parley Letter",
          comments: [2, 3]
        },
        comments: [{
          id: 2,
          name: "First comment"
        }, {
          id: 3,
          name: "Second comment"
        }]
      });
      var post;

      run(function () {
        post = store.createRecord("post", { name: "The Parley Letter" });
        post.save().then(function (post) {
          var comments = store.peekAll("comment");

          equal(get(comments, "length"), 2, "comments.length is correct");
          equal(get(comments, "firstObject.name"), "First comment", "comments.firstObject.name is correct");
          equal(get(comments, "lastObject.name"), "Second comment", "comments.lastObject.name is correct");
        });
      });
    });
  }
);


define(
  "ember-data/tests/integration/adapter/serialize-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var run = Ember.run;
    var env, store, adapter, serializer;

    module('integration/adapter/serialize - DS.Adapter integration test', {
      setup: function () {
        var Person = DS.Model.extend({
          name: DS.attr('string')
        });

        env = setupStore({ person: Person });
        store = env.store;
        adapter = env.adapter;
        serializer = store.serializerFor('person');
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    test('serialize() is delegated to the serializer', function () {
      expect(1);

      serializer.serialize = function (snapshot, options) {
        deepEqual(options, { foo: 'bar' });
      };

      run(function () {
        var person = store.createRecord('person');
        adapter.serialize(person._createSnapshot(), { foo: 'bar' });
      });
    });
  }
);


/*
 This is an integration test that tests the communication between a store
 and its adapter.

 Typically, when a method is invoked on the store, it calls a related
 method on its adapter. The adapter notifies the store that it has
 completed the assigned task, either synchronously or asynchronously,
 by calling a method on the store.

 These tests ensure that the proper methods get called, and, if applicable,
 the given record or record array changes state appropriately.
*/

define(
  "ember-data/tests/integration/adapter/store-adapter-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var set = Ember.set;
    var run = Ember.run;
    var Person, Dog, env, store, adapter;

    module('integration/adapter/store_adapter - DS.Store and DS.Adapter integration test', {
      setup: function () {
        Person = DS.Model.extend({
          updatedAt: DS.attr('string'),
          name: DS.attr('string'),
          firstName: DS.attr('string'),
          lastName: DS.attr('string')
        });

        Dog = DS.Model.extend({
          name: DS.attr('string')
        });

        env = setupStore({ person: Person, dog: Dog });
        store = env.store;
        adapter = env.adapter;
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    test('Records loaded multiple times and retrieved in recordArray are ready to send state events', function () {
      adapter.query = function (store, type, query, recordArray) {
        return Ember.RSVP.resolve([{
          id: 1,
          name: 'Mickael Ramírez'
        }, {
          id: 2,
          name: 'Johny Fontana'
        }]);
      };

      run(store, 'query', 'person', { q: 'bla' }).then(async(function (people) {
        var people2 = store.query('person', { q: 'bla2' });

        return Ember.RSVP.hash({ people: people, people2: people2 });
      })).then(async(function (results) {
        equal(results.people2.get('length'), 2, 'return the elements');
        ok(results.people2.get('isLoaded'), 'array is loaded');

        var person = results.people.objectAt(0);
        ok(person.get('isLoaded'), 'record is loaded');

        // delete record will not throw exception
        person.deleteRecord();
      }));
    });

    test('by default, createRecords calls createRecord once per record', function () {
      var count = 1;

      adapter.createRecord = function (store, type, snapshot) {
        equal(type, Person, 'the type is correct');

        if (count === 1) {
          equal(snapshot.attr('name'), 'Tom Dale');
        } else if (count === 2) {
          equal(snapshot.attr('name'), 'Yehuda Katz');
        } else {
          ok(false, 'should not have invoked more than 2 times');
        }

        var hash = snapshot.attributes();
        hash.id = count;
        hash.updatedAt = 'now';

        count++;
        return Ember.RSVP.resolve(hash);
      };
      var tom, yehuda;

      run(function () {
        tom = store.createRecord('person', { name: 'Tom Dale' });
        yehuda = store.createRecord('person', { name: 'Yehuda Katz' });
      });

      var promise = run(function () {
        return Ember.RSVP.hash({
          tom: tom.save(),
          yehuda: yehuda.save()
        });
      });
      promise.then(async(function (records) {
        tom = records.tom;
        yehuda = records.yehuda;

        asyncEqual(tom, store.findRecord('person', 1), 'Once an ID is in, find returns the same object');
        asyncEqual(yehuda, store.findRecord('person', 2), 'Once an ID is in, find returns the same object');
        equal(get(tom, 'updatedAt'), 'now', 'The new information is received');
        equal(get(yehuda, 'updatedAt'), 'now', 'The new information is received');
      }));
    });

    test('by default, updateRecords calls updateRecord once per record', function () {
      var count = 0;

      adapter.updateRecord = function (store, type, snapshot) {
        equal(type, Person, 'the type is correct');

        if (count === 0) {
          equal(snapshot.attr('name'), 'Tom Dale');
        } else if (count === 1) {
          equal(snapshot.attr('name'), 'Yehuda Katz');
        } else {
          ok(false, 'should not get here');
        }

        count++;

        equal(snapshot.record.get('isSaving'), true, 'record is saving');

        return Ember.RSVP.resolve();
      };

      run(function () {
        store.push('person', { id: 1, name: 'Braaaahm Dale' });
        store.push('person', { id: 2, name: 'Brohuda Katz' });
      });

      var promise = run(function () {
        return Ember.RSVP.hash({
          tom: store.findRecord('person', 1),
          yehuda: store.findRecord('person', 2)
        });
      });

      promise.then(async(function (records) {
        var tom = records.tom;
        var yehuda = records.yehuda;

        set(tom, 'name', 'Tom Dale');
        set(yehuda, 'name', 'Yehuda Katz');

        return Ember.RSVP.hash({ tom: tom.save(), yehuda: yehuda.save() });
      })).then(async(function (records) {
        var tom = records.tom;
        var yehuda = records.yehuda;

        equal(tom.get('isSaving'), false, 'record is no longer saving');
        equal(tom.get('isLoaded'), true, 'record is loaded');

        equal(yehuda.get('isSaving'), false, 'record is no longer saving');
        equal(yehuda.get('isLoaded'), true, 'record is loaded');
      }));
    });

    test('calling store.didSaveRecord can provide an optional hash', function () {
      var count = 0;

      adapter.updateRecord = function (store, type, snapshot) {
        equal(type, Person, 'the type is correct');

        count++;
        if (count === 1) {
          equal(snapshot.attr('name'), 'Tom Dale');
          return Ember.RSVP.resolve({ id: 1, name: 'Tom Dale', updatedAt: 'now' });
        } else if (count === 2) {
          equal(snapshot.attr('name'), 'Yehuda Katz');
          return Ember.RSVP.resolve({ id: 2, name: 'Yehuda Katz', updatedAt: 'now!' });
        } else {
          ok(false, 'should not get here');
        }
      };

      run(function () {
        store.push('person', { id: 1, name: 'Braaaahm Dale' });
        store.push('person', { id: 2, name: 'Brohuda Katz' });
      });

      var promise = run(function () {
        return Ember.RSVP.hash({
          tom: store.findRecord('person', 1),
          yehuda: store.findRecord('person', 2)
        });
      });
      promise.then(async(function (records) {
        var tom = records.tom;
        var yehuda = records.yehuda;

        set(tom, 'name', 'Tom Dale');
        set(yehuda, 'name', 'Yehuda Katz');

        return Ember.RSVP.hash({ tom: tom.save(), yehuda: yehuda.save() });
      })).then(async(function (records) {
        var tom = records.tom;
        var yehuda = records.yehuda;

        equal(get(tom, 'hasDirtyAttributes'), false, 'the record should not be dirty');
        equal(get(tom, 'updatedAt'), 'now', 'the hash was updated');

        equal(get(yehuda, 'hasDirtyAttributes'), false, 'the record should not be dirty');
        equal(get(yehuda, 'updatedAt'), 'now!', 'the hash was updated');
      }));
    });

    test('by default, deleteRecord calls deleteRecord once per record', function () {
      expect(4);

      var count = 0;

      adapter.deleteRecord = function (store, type, snapshot) {
        equal(type, Person, 'the type is correct');

        if (count === 0) {
          equal(snapshot.attr('name'), 'Tom Dale');
        } else if (count === 1) {
          equal(snapshot.attr('name'), 'Yehuda Katz');
        } else {
          ok(false, 'should not get here');
        }

        count++;

        return Ember.RSVP.resolve();
      };

      run(function () {
        store.push('person', { id: 1, name: 'Tom Dale' });
        store.push('person', { id: 2, name: 'Yehuda Katz' });
      });

      var promise = run(function () {
        return Ember.RSVP.hash({
          tom: store.findRecord('person', 1),
          yehuda: store.findRecord('person', 2)
        });
      });

      promise.then(async(function (records) {
        var tom = records.tom;
        var yehuda = records.yehuda;

        tom.deleteRecord();
        yehuda.deleteRecord();

        tom.save();
        yehuda.save();
      }));
    });

    test('by default, destroyRecord calls deleteRecord once per record without requiring .save', function () {
      expect(4);

      var count = 0;

      adapter.deleteRecord = function (store, type, snapshot) {
        equal(type, Person, 'the type is correct');

        if (count === 0) {
          equal(snapshot.attr('name'), 'Tom Dale');
        } else if (count === 1) {
          equal(snapshot.attr('name'), 'Yehuda Katz');
        } else {
          ok(false, 'should not get here');
        }

        count++;

        return Ember.RSVP.resolve();
      };

      run(function () {
        store.push('person', { id: 1, name: 'Tom Dale' });
        store.push('person', { id: 2, name: 'Yehuda Katz' });
      });

      var promise = run(function () {
        return Ember.RSVP.hash({
          tom: store.findRecord('person', 1),
          yehuda: store.findRecord('person', 2)
        });
      });

      promise.then(async(function (records) {
        var tom = records.tom;
        var yehuda = records.yehuda;

        tom.destroyRecord();
        yehuda.destroyRecord();
      }));
    });

    test('if an existing model is edited then deleted, deleteRecord is called on the adapter', function () {
      expect(5);

      var count = 0;

      adapter.deleteRecord = function (store, type, snapshot) {
        count++;
        equal(snapshot.id, 'deleted-record', 'should pass correct record to deleteRecord');
        equal(count, 1, 'should only call deleteRecord method of adapter once');

        return Ember.RSVP.resolve();
      };

      adapter.updateRecord = function () {
        ok(false, 'should not have called updateRecord method of adapter');
      };

      // Load data for a record into the store.
      run(function () {
        store.push('person', { id: 'deleted-record', name: 'Tom Dale' });
      });

      // Retrieve that loaded record and edit it so it becomes dirty
      run(store, 'findRecord', 'person', 'deleted-record').then(async(function (tom) {
        tom.set('name', 'Tom Mothereffin\' Dale');

        equal(get(tom, 'hasDirtyAttributes'), true, 'precond - record should be dirty after editing');

        tom.deleteRecord();
        return tom.save();
      })).then(async(function (tom) {
        equal(get(tom, 'hasDirtyAttributes'), false, 'record should not be dirty');
        equal(get(tom, 'isDeleted'), true, 'record should be considered deleted');
      }));
    });

    test('if a deleted record errors, it enters the error state', function () {
      var count = 0;

      adapter.deleteRecord = function (store, type, snapshot) {
        if (count++ === 0) {
          return Ember.RSVP.reject();
        } else {
          return Ember.RSVP.resolve();
        }
      };

      run(function () {
        store.push('person', { id: 'deleted-record', name: 'Tom Dale' });
      });

      var tom;

      run(function () {
        store.findRecord('person', 'deleted-record').then(async(function (person) {
          tom = person;
          person.deleteRecord();
          return person.save();
        })).then(null, async(function () {
          equal(tom.get('isError'), true, 'Tom is now errored');

          // this time it succeeds
          return tom.save();
        })).then(async(function () {
          equal(tom.get('isError'), false, 'Tom is not errored anymore');
        }));
      });
    });

    test('if a created record is marked as invalid by the server, it enters an error state', function () {
      adapter.createRecord = function (store, type, snapshot) {
        equal(type, Person, 'the type is correct');

        if (snapshot.attr('name').indexOf('Bro') === -1) {
          return Ember.RSVP.reject(new DS.InvalidError({ name: ['common... name requires a "bro"'] }));
        } else {
          return Ember.RSVP.resolve();
        }
      };

      var yehuda = run(function () {
        return store.createRecord('person', { id: 1, name: 'Yehuda Katz' });
      });
      // Wrap this in an Ember.run so that all chained async behavior is set up
      // before flushing any scheduled behavior.
      Ember.run(function () {
        yehuda.save().then(null, async(function (error) {
          equal(get(yehuda, 'isValid'), false, 'the record is invalid');
          ok(get(yehuda, 'errors.name'), 'The errors.name property exists');

          set(yehuda, 'updatedAt', true);
          equal(get(yehuda, 'isValid'), false, 'the record is still invalid');

          set(yehuda, 'name', 'Brohuda Brokatz');

          equal(get(yehuda, 'isValid'), true, 'the record is no longer invalid after changing');
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record has outstanding changes');

          equal(get(yehuda, 'isNew'), true, 'precond - record is still new');

          return yehuda.save();
        })).then(async(function (person) {
          strictEqual(person, yehuda, 'The promise resolves with the saved record');

          equal(get(yehuda, 'isValid'), true, 'record remains valid after committing');
          equal(get(yehuda, 'isNew'), false, 'record is no longer new');
        }));
      });
    });

    test('allows errors on arbitrary properties on create', function () {
      adapter.createRecord = function (store, type, snapshot) {
        if (snapshot.attr('name').indexOf('Bro') === -1) {
          return Ember.RSVP.reject(new DS.InvalidError({ base: ['is a generally unsavoury character'] }));
        } else {
          return Ember.RSVP.resolve();
        }
      };

      var yehuda = run(function () {
        return store.createRecord('person', { id: 1, name: 'Yehuda Katz' });
      });

      // Wrap this in an Ember.run so that all chained async behavior is set up
      // before flushing any scheduled behavior.
      run(function () {
        yehuda.save().then(null, async(function (error) {
          equal(get(yehuda, 'isValid'), false, 'the record is invalid');
          ok(get(yehuda, 'errors.base'), 'The errors.base property exists');
          deepEqual(get(yehuda, 'errors').errorsFor('base'), [{ attribute: 'base', message: 'is a generally unsavoury character' }]);

          set(yehuda, 'updatedAt', true);
          equal(get(yehuda, 'isValid'), false, 'the record is still invalid');

          set(yehuda, 'name', 'Brohuda Brokatz');

          equal(get(yehuda, 'isValid'), false, 'the record is still invalid as far as we know');
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record has outstanding changes');

          equal(get(yehuda, 'isNew'), true, 'precond - record is still new');

          return yehuda.save();
        })).then(async(function (person) {
          strictEqual(person, yehuda, 'The promise resolves with the saved record');
          ok(!get(yehuda, 'errors.base'), 'The errors.base property does not exist');
          deepEqual(get(yehuda, 'errors').errorsFor('base'), []);
          equal(get(yehuda, 'isValid'), true, 'record remains valid after committing');
          equal(get(yehuda, 'isNew'), false, 'record is no longer new');
        }));
      });
    });

    test('if a created record is marked as invalid by the server, you can attempt the save again', function () {
      var saveCount = 0;
      adapter.createRecord = function (store, type, snapshot) {
        equal(type, Person, 'the type is correct');
        saveCount++;

        if (snapshot.attr('name').indexOf('Bro') === -1) {
          return Ember.RSVP.reject(new DS.InvalidError({ name: ['common... name requires a "bro"'] }));
        } else {
          return Ember.RSVP.resolve();
        }
      };

      var yehuda = run(function () {
        return store.createRecord('person', { id: 1, name: 'Yehuda Katz' });
      });

      // Wrap this in an Ember.run so that all chained async behavior is set up
      // before flushing any scheduled behavior.
      Ember.run(function () {
        yehuda.save().then(null, async(function (reason) {
          equal(saveCount, 1, 'The record has been saved once');
          ok(reason.message.match('The adapter rejected the commit because it was invalid'), 'It should fail due to being invalid');
          equal(get(yehuda, 'isValid'), false, 'the record is invalid');
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record has outstanding changes');
          ok(get(yehuda, 'errors.name'), 'The errors.name property exists');
          equal(get(yehuda, 'isNew'), true, 'precond - record is still new');
          return yehuda.save();
        })).then(null, async(function (reason) {
          equal(saveCount, 2, 'The record has been saved twice');
          ok(reason.message.match('The adapter rejected the commit because it was invalid'), 'It should fail due to being invalid');
          equal(get(yehuda, 'isValid'), false, 'the record is still invalid');
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record has outstanding changes');
          ok(get(yehuda, 'errors.name'), 'The errors.name property exists');
          equal(get(yehuda, 'isNew'), true, 'precond - record is still new');
          set(yehuda, 'name', 'Brohuda Brokatz');
          return yehuda.save();
        })).then(async(function (person) {
          equal(saveCount, 3, 'The record has been saved thrice');
          equal(get(yehuda, 'isValid'), true, 'record is valid');
          equal(get(yehuda, 'hasDirtyAttributes'), false, 'record is not dirty');
          equal(get(yehuda, 'errors.isEmpty'), true, 'record has no errors');
        }));
      });
    });

    test('if a created record is marked as erred by the server, it enters an error state', function () {
      adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.reject();
      };

      Ember.run(function () {
        var person = store.createRecord('person', { id: 1, name: 'John Doe' });

        person.save().then(null, async(function () {
          ok(get(person, 'isError'), 'the record is in the error state');
        }));
      });
    });

    test('if an updated record is marked as invalid by the server, it enters an error state', function () {
      adapter.updateRecord = function (store, type, snapshot) {
        equal(type, Person, 'the type is correct');

        if (snapshot.attr('name').indexOf('Bro') === -1) {
          return Ember.RSVP.reject(new DS.InvalidError({ name: ['common... name requires a "bro"'] }));
        } else {
          return Ember.RSVP.resolve();
        }
      };

      var yehuda = run(function () {
        return store.push('person', { id: 1, name: 'Brohuda Brokatz' });
      });

      Ember.run(function () {
        store.findRecord('person', 1).then(async(function (person) {
          equal(person, yehuda, 'The same object is passed through');

          equal(get(yehuda, 'isValid'), true, 'precond - the record is valid');
          set(yehuda, 'name', 'Yehuda Katz');
          equal(get(yehuda, 'isValid'), true, 'precond - the record is still valid as far as we know');

          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record is dirty');

          return yehuda.save();
        })).then(null, async(function (reason) {
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record is still dirty');
          equal(get(yehuda, 'isValid'), false, 'the record is invalid');

          set(yehuda, 'updatedAt', true);
          equal(get(yehuda, 'isValid'), false, 'the record is still invalid');

          set(yehuda, 'name', 'Brohuda Brokatz');
          equal(get(yehuda, 'isValid'), true, 'the record is no longer invalid after changing');
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record has outstanding changes');

          return yehuda.save();
        })).then(async(function (yehuda) {
          equal(get(yehuda, 'isValid'), true, 'record remains valid after committing');
          equal(get(yehuda, 'hasDirtyAttributes'), false, 'record is no longer new');
        }));
      });
    });

    test('records can have errors on arbitrary properties after update', function () {
      adapter.updateRecord = function (store, type, snapshot) {
        if (snapshot.attr('name').indexOf('Bro') === -1) {
          return Ember.RSVP.reject(new DS.InvalidError({ base: ['is a generally unsavoury character'] }));
        } else {
          return Ember.RSVP.resolve();
        }
      };

      var yehuda = run(function () {
        return store.push('person', { id: 1, name: 'Brohuda Brokatz' });
      });

      run(function () {
        store.findRecord('person', 1).then(async(function (person) {
          equal(person, yehuda, 'The same object is passed through');

          equal(get(yehuda, 'isValid'), true, 'precond - the record is valid');
          set(yehuda, 'name', 'Yehuda Katz');
          equal(get(yehuda, 'isValid'), true, 'precond - the record is still valid as far as we know');

          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record is dirty');

          return yehuda.save();
        })).then(null, async(function (reason) {
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record is still dirty');
          equal(get(yehuda, 'isValid'), false, 'the record is invalid');
          ok(get(yehuda, 'errors.base'), 'The errors.base property exists');
          deepEqual(get(yehuda, 'errors').errorsFor('base'), [{ attribute: 'base', message: 'is a generally unsavoury character' }]);

          set(yehuda, 'updatedAt', true);
          equal(get(yehuda, 'isValid'), false, 'the record is still invalid');

          set(yehuda, 'name', 'Brohuda Brokatz');
          equal(get(yehuda, 'isValid'), false, 'the record is still invalid after changing (only server can know if it\'s now valid)');
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record has outstanding changes');

          return yehuda.save();
        })).then(async(function (yehuda) {
          equal(get(yehuda, 'isValid'), true, 'record remains valid after committing');
          equal(get(yehuda, 'hasDirtyAttributes'), false, 'record is no longer new');
          ok(!get(yehuda, 'errors.base'), 'The errors.base property does not exist');
          deepEqual(get(yehuda, 'errors').errorsFor('base'), []);
        }));
      });
    });

    test('if an updated record is marked as invalid by the server, you can attempt the save again', function () {
      var saveCount = 0;
      adapter.updateRecord = function (store, type, snapshot) {
        equal(type, Person, 'the type is correct');
        saveCount++;
        if (snapshot.attr('name').indexOf('Bro') === -1) {
          return Ember.RSVP.reject(new DS.InvalidError({ name: ['common... name requires a "bro"'] }));
        } else {
          return Ember.RSVP.resolve();
        }
      };

      var yehuda = run(function () {
        return store.push('person', { id: 1, name: 'Brohuda Brokatz' });
      });

      Ember.run(function () {
        store.findRecord('person', 1).then(async(function (person) {
          equal(person, yehuda, 'The same object is passed through');

          equal(get(yehuda, 'isValid'), true, 'precond - the record is valid');
          set(yehuda, 'name', 'Yehuda Katz');
          equal(get(yehuda, 'isValid'), true, 'precond - the record is still valid as far as we know');

          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record is dirty');

          return yehuda.save();
        })).then(null, async(function (reason) {
          equal(saveCount, 1, 'The record has been saved once');
          ok(reason.message.match('The adapter rejected the commit because it was invalid'), 'It should fail due to being invalid');
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'the record is still dirty');
          equal(get(yehuda, 'isValid'), false, 'the record is invalid');
          return yehuda.save();
        })).then(null, async(function (reason) {
          equal(saveCount, 2, 'The record has been saved twice');
          ok(reason.message.match('The adapter rejected the commit because it was invalid'), 'It should fail due to being invalid');
          equal(get(yehuda, 'isValid'), false, 'record is still invalid');
          equal(get(yehuda, 'hasDirtyAttributes'), true, 'record is still dirty');
          set(yehuda, 'name', 'Brohuda Brokatz');
          return yehuda.save();
        })).then(async(function (person) {
          equal(saveCount, 3, 'The record has been saved thrice');
          equal(get(yehuda, 'isValid'), true, 'record is valid');
          equal(get(yehuda, 'hasDirtyAttributes'), false, 'record is not dirty');
          equal(get(yehuda, 'errors.isEmpty'), true, 'record has no errors');
        }));
      });
    });

    test('if a updated record is marked as erred by the server, it enters an error state', function () {
      adapter.updateRecord = function (store, type, snapshot) {
        return Ember.RSVP.reject();
      };

      var person = run(function () {
        return store.push('person', { id: 1, name: 'John Doe' });
      });

      run(store, 'findRecord', 'person', 1).then(async(function (record) {
        equal(record, person, 'The person was resolved');
        person.set('name', 'Jonathan Doe');
        return person.save();
      })).then(null, async(function (reason) {
        ok(get(person, 'isError'), 'the record is in the error state');
      }));
    });

    test('can be created after the DS.Store', function () {
      expect(1);

      adapter.findRecord = function (store, type, id, snapshot) {
        equal(type, Person, 'the type is correct');
        return Ember.RSVP.resolve({ id: 1 });
      };

      run(function () {
        store.findRecord('person', 1);
      });
    });

    test('the filter method can optionally take a server query as well', function () {
      adapter.query = function (store, type, query, array) {
        return Ember.RSVP.resolve([{ id: 1, name: 'Yehuda Katz' }, { id: 2, name: 'Tom Dale' }]);
      };

      var asyncFilter = store.filter('person', { page: 1 }, function (data) {
        return data.get('name') === 'Tom Dale';
      });

      var loadedFilter;

      asyncFilter.then(async(function (filter) {
        loadedFilter = filter;
        return store.findRecord('person', 2);
      })).then(async(function (tom) {
        equal(get(loadedFilter, 'length'), 1, 'The filter has an item in it');
        deepEqual(loadedFilter.toArray(), [tom], 'The filter has a single entry in it');
      }));
    });

    test('relationships returned via `commit` do not trigger additional findManys', function () {
      Person.reopen({
        dogs: DS.hasMany('dog', { async: false })
      });

      run(function () {
        store.push('dog', { id: 1, name: 'Scruffy' });
      });

      adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.resolve({ id: 1, name: 'Tom Dale', dogs: [1] });
      };

      adapter.updateRecord = function (store, type, snapshot) {
        return new Ember.RSVP.Promise(function (resolve, reject) {
          store.push('person', { id: 1, name: 'Tom Dale', dogs: [1, 2] });
          store.push('dog', { id: 2, name: 'Scruffles' });
          resolve({ id: 1, name: 'Scruffy' });
        });
      };

      adapter.findMany = function (store, type, ids, snapshots) {
        ok(false, 'Should not get here');
      };

      run(function () {
        store.findRecord('person', 1).then(async(function (person) {
          return Ember.RSVP.hash({ tom: person, dog: store.findRecord('dog', 1) });
        })).then(async(function (records) {
          records.tom.get('dogs');
          return records.dog.save();
        })).then(async(function (tom) {
          ok(true, 'Tom was saved');
        }));
      });
    });

    test('relationships don\'t get reset if the links is the same', function () {
      Person.reopen({
        dogs: DS.hasMany({ async: true })
      });

      var count = 0;

      adapter.findHasMany = function (store, snapshot, link, relationship) {
        ok(count++ === 0, 'findHasMany is only called once');

        return Ember.RSVP.resolve([{ id: 1, name: 'Scruffy' }]);
      };

      run(function () {
        store.push('person', { id: 1, name: 'Tom Dale', links: { dogs: '/dogs' } });
      });

      var tom, dogs;

      run(store, 'findRecord', 'person', 1).then(async(function (person) {
        tom = person;
        dogs = tom.get('dogs');
        return dogs;
      })).then(async(function (dogs) {
        equal(dogs.get('length'), 1, 'The dogs are loaded');
        store.push('person', { id: 1, name: 'Tom Dale', links: { dogs: '/dogs' } });
        ok(tom.get('dogs') instanceof DS.PromiseArray, 'dogs is a promise');
        return tom.get('dogs');
      })).then(async(function (dogs) {
        equal(dogs.get('length'), 1, 'The same dogs are loaded');
      }));
    });

    test('async hasMany always returns a promise', function () {
      Person.reopen({
        dogs: DS.hasMany({ async: true })
      });

      adapter.createRecord = function (store, type, snapshot) {
        var hash = { name: 'Tom Dale' };
        hash.dogs = [];
        hash.id = 1;
        return Ember.RSVP.resolve(hash);
      };
      var tom;

      run(function () {
        tom = store.createRecord('person', { name: 'Tom Dale' });
      });

      ok(tom.get('dogs') instanceof DS.PromiseArray, 'dogs is a promise before save');

      run(function () {
        tom.save().then(async(function () {
          ok(tom.get('dogs') instanceof DS.PromiseArray, 'dogs is a promise after save');
        }));
      });
    });

    test('createRecord receives a snapshot', function () {
      expect(1);

      adapter.createRecord = function (store, type, snapshot) {
        ok(snapshot instanceof DS.Snapshot, 'snapshot is an instance of DS.Snapshot');
        return Ember.RSVP.resolve();
      };

      var person;

      run(function () {
        person = store.createRecord('person', { name: 'Tom Dale' });
        person.save();
      });
    });

    test('updateRecord receives a snapshot', function () {
      expect(1);

      adapter.updateRecord = function (store, type, snapshot) {
        ok(snapshot instanceof DS.Snapshot, 'snapshot is an instance of DS.Snapshot');
        return Ember.RSVP.resolve();
      };

      var person;

      run(function () {
        person = store.push('person', { id: 1, name: 'Tom Dale' });
      });

      run(function () {
        set(person, 'name', 'Tomster');
        person.save();
      });
    });

    test('deleteRecord receives a snapshot', function () {
      expect(1);

      adapter.deleteRecord = function (store, type, snapshot) {
        ok(snapshot instanceof DS.Snapshot, 'snapshot is an instance of DS.Snapshot');
        return Ember.RSVP.resolve();
      };

      var person;

      run(function () {
        person = store.push('person', { id: 1, name: 'Tom Dale' });
      });

      run(function () {
        person.deleteRecord();
        person.save();
      });
    });

    test('find receives a snapshot', function () {
      expect(1);

      adapter.findRecord = function (store, type, id, snapshot) {
        ok(snapshot instanceof DS.Snapshot, 'snapshot is an instance of DS.Snapshot');
        return Ember.RSVP.resolve({ id: 1 });
      };

      run(function () {
        store.findRecord('person', 1);
      });
    });

    test('findMany receives an array of snapshots', function () {
      expect(2);

      Person.reopen({
        dogs: DS.hasMany({ async: true })
      });

      adapter.coalesceFindRequests = true;
      adapter.findMany = function (store, type, ids, snapshots) {
        ok(snapshots[0] instanceof DS.Snapshot, 'snapshots[0] is an instance of DS.Snapshot');
        ok(snapshots[1] instanceof DS.Snapshot, 'snapshots[1] is an instance of DS.Snapshot');
        return Ember.RSVP.resolve([{ id: 2 }, { id: 3 }]);
      };

      var person;

      run(function () {
        person = store.push('person', { id: 1, dogs: [2, 3] });
      });

      run(function () {
        person.get('dogs');
      });
    });

    test('findHasMany receives a snapshot', function () {
      expect(1);

      Person.reopen({
        dogs: DS.hasMany({ async: true })
      });

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        ok(snapshot instanceof DS.Snapshot, 'snapshot is an instance of DS.Snapshot');
        return Ember.RSVP.resolve([{ id: 2 }, { id: 3 }]);
      };

      var person;

      run(function () {
        person = store.push('person', { id: 1, links: { dogs: 'dogs' } });
      });

      run(function () {
        person.get('dogs');
      });
    });

    test('findBelongsTo receives a snapshot', function () {
      expect(1);

      Person.reopen({
        dog: DS.belongsTo({ async: true })
      });

      env.adapter.findBelongsTo = async(function (store, snapshot, link, relationship) {
        ok(snapshot instanceof DS.Snapshot, 'snapshot is an instance of DS.Snapshot');
        return Ember.RSVP.resolve({ id: 2 });
      });

      var person;

      run(function () {
        person = store.push('person', { id: 1, links: { dog: 'dog' } });
      });

      run(function () {
        person.get('dog');
      });
    });

    test('record.save should pass adapterOptions to the updateRecord method', function () {
      expect(1);

      env.adapter.updateRecord = async(function (store, type, snapshot) {
        deepEqual(snapshot.adapterOptions, { subscribe: true });
        return Ember.RSVP.resolve({ id: 1 });
      });

      run(function () {
        var person = store.push('person', { id: 1, name: 'Tom' });
        person.save({ adapterOptions: { subscribe: true } });
      });
    });

    test('record.save should pass adapterOptions to the createRecord method', function () {
      expect(1);

      env.adapter.createRecord = async(function (store, type, snapshot) {
        deepEqual(snapshot.adapterOptions, { subscribe: true });
        return Ember.RSVP.resolve({ id: 1 });
      });

      run(function () {
        var person = store.createRecord('person', { name: 'Tom' });
        person.save({ adapterOptions: { subscribe: true } });
      });
    });

    test('record.save should pass adapterOptions to the deleteRecord method', function () {
      expect(1);

      env.adapter.deleteRecord = async(function (store, type, snapshot) {
        deepEqual(snapshot.adapterOptions, { subscribe: true });
        return Ember.RSVP.resolve({ id: 1 });
      });

      run(function () {
        var person = store.push('person', { id: 1, name: 'Tom' });
        person.destroyRecord({ adapterOptions: { subscribe: true } });
      });
    });

    test('findRecord should pass adapterOptions to the find method', function () {
      expect(1);

      env.adapter.findRecord = async(function (store, type, id, snapshot) {
        deepEqual(snapshot.adapterOptions, { query: { embed: true } });
        return Ember.RSVP.resolve({ id: 1 });
      });

      run(function () {
        store.findRecord('person', 1, { adapterOptions: { query: { embed: true } } });
      });
    });

    test('findAll should pass adapterOptions to the findAll method', function () {
      expect(1);

      env.adapter.findAll = async(function (store, type, sinceToken, arraySnapshot) {
        var adapterOptions = arraySnapshot.adapterOptions;
        deepEqual(adapterOptions, { query: { embed: true } });
        return Ember.RSVP.resolve([{ id: 1 }]);
      });

      run(function () {
        store.findAll('person', { adapterOptions: { query: { embed: true } } });
      });
    });

    test('An async hasMany relationship with links should not trigger shouldBackgroundReloadRecord', function () {
      var Post = DS.Model.extend({
        name: DS.attr('string'),
        comments: DS.hasMany('comment', { async: true })
      });

      var Comment = DS.Model.extend({
        name: DS.attr('string')
      });

      env = setupStore({
        post: Post,
        comment: Comment,
        adapter: DS.RESTAdapter.extend({
          findRecord: function () {
            return {
              posts: {
                id: 1,
                name: 'Rails is omakase',
                links: { comments: '/posts/1/comments' }
              }
            };
          },
          findHasMany: function () {
            return Ember.RSVP.resolve({
              comments: [{ id: 1, name: 'FIRST' }, { id: 2, name: 'Rails is unagi' }, { id: 3, name: 'What is omakase?' }]
            });
          },
          shouldBackgroundReloadRecord: function () {
            ok(false, 'shouldBackgroundReloadRecord should not be called');
          }
        })
      });

      store = env.store;

      run(store, 'find', 'post', '1').then(async(function (post) {
        return post.get('comments');
      })).then(async(function (comments) {
        equal(comments.get('length'), 3);
      }));
    });
  }
);


define(
  "ember-data/tests/integration/application-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var run = Ember.run;
    var Application = Ember.Application;
    var Controller = Ember.Controller;
    var Store = DS.Store;
    var Namespace = Ember.Namespace;

    var app, App, container;

    /*
      These tests ensure that Ember Data works with Ember.js' application
      initialization and dependency injection APIs.
    */

    function getStore() {
      return lookup('service:store');
    }

    function lookup(thing) {
      return run(container, 'lookup', thing);
    }

    module('integration/application - Injecting a Custom Store', {
      setup: function () {
        run(function () {
          app = Application.create({
            StoreService: Store.extend({ isCustom: true }),
            FooController: Controller.extend(),
            BazController: {},
            ApplicationController: Controller.extend(),
            rootElement: '#qunit-fixture'
          });
        });

        container = app.__container__;
      },

      teardown: function () {
        run(app, app.destroy);
        Ember.BOOTED = false;
      }
    });

    test('If a Store property exists on an Ember.Application, it should be instantiated.', function () {
      run(function () {
        ok(getStore().get('isCustom'), 'the custom store was instantiated');
      });
    });

    test('If a store is instantiated, it should be made available to each controller.', function () {
      var fooController = lookup('controller:foo');
      var isCustom = run(fooController, 'get', 'store.isCustom');
      ok(isCustom, 'the custom store was injected');
    });

    test('The JSONAPIAdapter is the default adapter when no custom adapter is provided', function () {
      run(function () {
        var store = getStore();

        var adapter = store.adapterFor('application');

        ok(adapter instanceof DS.JSONAPIAdapter, 'default adapter should be the JSONAPIAdapter');
      });
    });

    module('integration/application - Injecting the Default Store', {
      setup: function () {
        run(function () {
          app = Application.create({
            FooController: Controller.extend(),
            BazController: {},
            ApplicationController: Controller.extend()
          });
        });

        container = app.__container__;
      },

      teardown: function () {
        run(app, 'destroy');
        Ember.BOOTED = false;
      }
    });

    test('If a Store property exists on an Ember.Application, it should be instantiated.', function () {
      ok(getStore() instanceof DS.Store, 'the store was instantiated');
    });

    test('If a store is instantiated, it should be made available to each controller.', function () {
      run(function () {
        var fooController = lookup('controller:foo');
        ok(fooController.get('store') instanceof DS.Store, 'the store was injected');
      });
    });

    test('the DS namespace should be accessible', function () {
      run(function () {
        ok(Namespace.byName('DS') instanceof Namespace, 'the DS namespace is accessible');
      });
    });

    if (Ember.inject && Ember.inject.service) {
      module('integration/application - Using the store as a service', {
        setup: function () {
          run(function () {
            app = Application.create({
              DoodleService: Ember.Service.extend({ store: Ember.inject.service() })
            });
          });

          container = app.__container__;
        },

        teardown: function () {
          run(app, 'destroy');
          Ember.BOOTED = false;
        }
      });

      test('The store can be injected as a service', function () {
        run(function () {
          var doodleService = lookup('service:doodle');
          ok(doodleService.get('store') instanceof Store, 'the store can be used as a service');
        });
      });
    }

    module('integration/application - Attaching initializer', {
      setup: function () {
        App = Application.extend();
      },

      teardown: function () {
        if (app) {
          run(app, app.destroy);
        }
        Ember.BOOTED = false;
      }
    });

    test('ember-data initializer is run', function () {
      var ran = false;
      App.initializer({
        name: 'after-ember-data',
        after: 'ember-data',
        initialize: function () {
          ran = true;
        }
      });

      run(function () {
        app = App.create();
      });

      ok(ran, 'ember-data initializer was found');
    });

    test('ember-data initializer does not register the store service when it was already registered', function () {

      var AppStore = Store.extend({
        isCustomStore: true
      });

      App.initializer({
        name: 'after-ember-data',
        before: 'ember-data',
        initialize: function (registry) {
          registry.register('service:store', AppStore);
        }
      });

      run(function () {
        app = App.create();
        container = app.__container__;
      });

      var store = getStore();
      ok(store && store.get('isCustomStore'), 'ember-data initializer does not overwrite the previous registered service store');
    });

    test('store initializer is run (DEPRECATED)', function () {
      var ran = false;
      App.initializer({
        name: 'after-store',
        after: 'store',
        initialize: function () {
          ran = true;
        }
      });

      run(function () {
        app = App.create();
      });

      ok(ran, 'store initializer was found');
    });

    test('injectStore initializer is run (DEPRECATED)', function () {
      var ran = false;
      App.initializer({
        name: 'after-store',
        after: 'injectStore',
        initialize: function () {
          ran = true;
        }
      });

      run(function () {
        app = App.create();
      });

      ok(ran, 'injectStore initializer was found');
    });

    test('transforms initializer is run (DEPRECATED)', function () {
      var ran = false;
      App.initializer({
        name: 'after-store',
        after: 'transforms',
        initialize: function () {
          ran = true;
        }
      });

      run(function () {
        app = App.create();
      });

      ok(ran, 'transforms initializer was found');
    });
  }
);


define(
  "ember-data/tests/integration/backwards-compat/deprecate-type-key-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Post, env;
    module('integration/backwards-compat/deprecate-type-key', {
      setup: function () {
        env = setupStore({
          post: DS.Model.extend()
        });
        Post = env.store.modelFor('post');
      },

      teardown: function () {}
    });

    if (Ember.platform.hasPropertyAccessors) {
      test('typeKey is deprecated', function () {
        expectDeprecation(function () {
          return Post.typeKey;
        });
      });

      test('setting typeKey is not allowed', function () {
        throws(function () {
          Post.typeKey = 'hello';
        });
      });
    }
  }
);


define(
  "ember-data/tests/integration/backwards-compat/non-dasherized-lookups",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var App, store;

    var run = Ember.run;
    module('integration/backwards-compat/non-dasherized-lookups - non dasherized lookups in application code finders', {
      setup: function () {
        run(function () {
          App = Ember.Application.create();
          App.PostNote = DS.Model.extend({
            name: DS.attr()
          });
        });
        store = App.__container__.lookup('service:store');
      },
      teardown: function () {
        run(App, 'destroy');
        App = null;
      }
    });

    test('can lookup models using camelCase strings', function () {
      expect(1);
      run(function () {
        store.pushPayload('postNote', {
          postNote: {
            id: 1,
            name: 'Ember Data'
          }
        });
      });

      run(function () {
        store.find('postNote', 1).then(async(function (postNote) {
          equal(postNote.get('id'), 1);
        }));
      });
    });

    test('can lookup models using underscored strings', function () {
      run(function () {
        store.pushPayload('post_note', {
          postNote: {
            id: 1,
            name: 'Ember Data'
          }
        });

        run(function () {
          store.find('post_note', 1).then(async(function (postNote) {
            equal(postNote.get('id'), 1);
          }));
        });
      });
    });

    module('integration/backwards-compat/non-dasherized-lookups - non dasherized lookups in application code relationship macros', {
      setup: function () {
        run(function () {
          App = Ember.Application.create();
          App.PostNote = DS.Model.extend({
            notePost: DS.belongsTo('notePost', { async: false }),
            name: DS.attr()
          });
          App.NotePost = DS.Model.extend({
            name: DS.attr()
          });
          App.LongModelName = DS.Model.extend({
            postNotes: DS.hasMany('post_note', { async: false })
          });
        });
        store = App.__container__.lookup('service:store');
      },

      teardown: function () {
        run(App, 'destroy');
        App = null;
      }
    });

    test('looks up using camelCase string', function () {
      expect(1);

      run(function () {
        store.push('postNote', {
          id: 1,
          notePost: 1
        });
        store.push('notePost', {
          id: 1,
          name: 'Inverse'
        });
      });

      run(function () {
        store.find('postNote', 1).then(function (postNote) {
          equal(postNote.get('notePost'), store.peekRecord('notePost', 1));
        });
      });
    });

    test('looks up using under_score string', function () {
      expect(1);

      run(function () {
        store.push('long_model_name', {
          id: 1,
          name: 'Inverse',
          postNotes: ['1']
        });
        store.push('postNote', {
          id: 1,
          name: 'Underscore'
        });
      });

      run(function () {
        store.find('long_model_name', 1).then(function (longModelName) {
          deepEqual(longModelName.get('postNotes').toArray(), [store.peekRecord('postNote', 1)]);
        });
      });
    });
  }
);


define(
  "ember-data/tests/integration/client-id-generation-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var Post, Comment, Misc, env;
    var run = Ember.run;

    module('integration/client_id_generation - Client-side ID Generation', {
      setup: function () {
        Comment = DS.Model.extend({
          post: DS.belongsTo('post', { async: false })
        });

        Post = DS.Model.extend({
          comments: DS.hasMany('comment', { async: false })
        });

        Misc = DS.Model.extend({
          foo: DS.attr('string')
        });

        env = setupStore({
          post: Post,
          comment: Comment,
          misc: Misc
        });
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    test('If an adapter implements the `generateIdForRecord` method, the store should be able to assign IDs without saving to the persistence layer.', function () {
      expect(6);

      var idCount = 1;

      env.adapter.generateIdForRecord = function (passedStore, record) {
        equal(env.store, passedStore, 'store is the first parameter');

        return 'id-' + idCount++;
      };

      env.adapter.createRecord = function (store, type, snapshot) {
        if (type === Comment) {
          equal(snapshot.id, 'id-1', 'Comment passed to `createRecord` has \'id-1\' assigned');
          return Ember.RSVP.resolve();
        } else {
          equal(snapshot.id, 'id-2', 'Post passed to `createRecord` has \'id-2\' assigned');
          return Ember.RSVP.resolve();
        }
      };

      var comment, post;
      run(function () {
        comment = env.store.createRecord('comment');
        post = env.store.createRecord('post');
      });

      equal(get(comment, 'id'), 'id-1', 'comment is assigned id \'id-1\'');
      equal(get(post, 'id'), 'id-2', 'post is assigned id \'id-2\'');

      // Despite client-generated IDs, calling commit() on the store should still
      // invoke the adapter's `createRecord` method.
      run(function () {
        comment.save();
        post.save();
      });
    });

    test('empty string and undefined ids should coerce to null', function () {
      expect(6);
      var comment, post;
      var idCount = 0;
      var ids = [undefined, ''];
      env.adapter.generateIdForRecord = function (passedStore, record) {
        equal(env.store, passedStore, 'store is the first parameter');

        return ids[idCount++];
      };

      env.adapter.createRecord = function (store, type, record) {
        equal(typeof get(record, 'id'), 'object', 'correct type');
        return Ember.RSVP.resolve();
      };

      run(function () {
        comment = env.store.createRecord('misc');
        post = env.store.createRecord('misc');
      });

      equal(get(comment, 'id'), null, 'comment is assigned id \'null\'');
      equal(get(post, 'id'), null, 'post is assigned id \'null\'');

      // Despite client-generated IDs, calling commit() on the store should still
      // invoke the adapter's `createRecord` method.
      run(function () {
        comment.save();
        post.save();
      });
    });
  }
);


define(
  "ember-data/tests/integration/debug-adapter-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var App, store, debugAdapter;
    var get = Ember.get;
    var run = Ember.run;

    module('DS.DebugAdapter', {
      setup: function () {
        Ember.run(function () {
          App = Ember.Application.create();
          App.toString = function () {
            return 'App';
          };

          App.StoreService = DS.Store.extend({
            adapter: DS.Adapter.extend()
          });

          App.Post = DS.Model.extend({
            title: DS.attr('string')
          });

          // TODO: Remove this when Ember is upgraded to >= 1.13
          App.Post.reopenClass({
            _debugContainerKey: 'model:post'
          });
        });

        store = App.__container__.lookup('service:store');
        debugAdapter = App.__container__.lookup('data-adapter:main');

        debugAdapter.reopen({
          getModelTypes: function () {
            return Ember.A([{ klass: App.__container__.lookupFactory('model:post'), name: 'post' }]);
          }
        });
      },
      teardown: function () {
        run(App, App.destroy);
      }
    });

    test('Watching Model Types', function () {
      expect(5);

      var added = function (types) {
        equal(types.length, 1);
        equal(types[0].name, 'post');
        equal(types[0].count, 0);
        strictEqual(types[0].object, store.modelFor('post'));
      };

      var updated = function (types) {
        equal(types[0].count, 1);
      };

      debugAdapter.watchModelTypes(added, updated);

      run(function () {
        store.push('post', { id: 1, title: 'Post Title' });
      });
    });

    test('Watching Records', function () {
      var post, record, addedRecords, updatedRecords, removedIndex, removedCount;

      Ember.run(function () {
        store.push('post', { id: '1', title: 'Clean Post' });
      });

      var recordsAdded = function (wrappedRecords) {
        addedRecords = wrappedRecords;
      };
      var recordsUpdated = function (wrappedRecords) {
        updatedRecords = wrappedRecords;
      };
      var recordsRemoved = function (index, count) {
        removedIndex = index;
        removedCount = count;
      };

      var modelClassOrName = undefined;
      if (debugAdapter.get('acceptsModelName')) {
        modelClassOrName = 'post';
      } else {
        modelClassOrName = App.__container__.lookupFactory('model:post');
      }
      debugAdapter.watchRecords(modelClassOrName, recordsAdded, recordsUpdated, recordsRemoved);

      equal(get(addedRecords, 'length'), 1);
      record = addedRecords[0];
      deepEqual(record.columnValues, { id: '1', title: 'Clean Post' });
      deepEqual(record.filterValues, { isNew: false, isModified: false, isClean: true });
      deepEqual(record.searchKeywords, ['1', 'Clean Post']);
      deepEqual(record.color, 'black');

      Ember.run(function () {
        post = store.find('post', 1);
      });

      Ember.run(function () {
        post.set('title', 'Modified Post');
      });

      equal(get(updatedRecords, 'length'), 1);
      record = updatedRecords[0];
      deepEqual(record.columnValues, { id: '1', title: 'Modified Post' });
      deepEqual(record.filterValues, { isNew: false, isModified: true, isClean: false });
      deepEqual(record.searchKeywords, ['1', 'Modified Post']);
      deepEqual(record.color, 'blue');

      run(function () {
        post = store.createRecord('post', { id: '2', title: 'New Post' });
      });
      equal(get(addedRecords, 'length'), 1);
      record = addedRecords[0];
      deepEqual(record.columnValues, { id: '2', title: 'New Post' });
      deepEqual(record.filterValues, { isNew: true, isModified: false, isClean: false });
      deepEqual(record.searchKeywords, ['2', 'New Post']);
      deepEqual(record.color, 'green');

      Ember.run(post, 'deleteRecord');

      equal(removedIndex, 1);
      equal(removedCount, 1);
    });
  }
);


define(
  "ember-data/tests/integration/filter-test",
  ["ember-data/tests/helpers/custom-adapter", "exports"],
  function(ember$data$tests$helpers$custom$adapter$$, __exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var customAdapter;
    customAdapter = ember$data$tests$helpers$custom$adapter$$["default"];

    var get = Ember.get;
    var set = Ember.set;
    var run = Ember.run;

    var Person, store, env, array, recordArray;

    var shouldContain = function (array, item) {
      ok(array.indexOf(item) !== -1, 'array should contain ' + item.get('name'));
    };

    var shouldNotContain = function (array, item) {
      ok(array.indexOf(item) === -1, 'array should not contain ' + item.get('name'));
    };

    module('integration/filter - DS.Model updating', {
      setup: function () {
        array = [{
          id: '1',
          type: 'person',
          attributes: {
            name: 'Scumbag Dale'
          },
          relationships: {
            bestFriend: {
              data: {
                id: '2',
                type: 'person'
              }
            }
          }
        }, {
          id: '2',
          type: 'person',
          attributes: {
            name: 'Scumbag Katz'
          }
        }, {
          id: '3',
          type: 'person',
          attributes: {
            name: 'Scumbag Bryn'
          }
        }];
        Person = DS.Model.extend({ name: DS.attr('string'), bestFriend: DS.belongsTo('person', { inverse: null, async: false }) });

        env = setupStore({ person: Person });
        store = env.store;
      },
      teardown: function () {
        run(store, 'destroy');
        Person = null;
        array = null;
      }
    });

    function tapFn(fn, callback) {
      var old_fn = fn;

      var new_fn = function () {
        var result = old_fn.apply(this, arguments);
        if (callback) {
          callback.apply(fn, arguments);
        }
        new_fn.summary.called.push(arguments);
        return result;
      };
      new_fn.summary = { called: [] };

      return new_fn;
    }

    test('when a DS.Model updates its attributes, its changes affect its filtered Array membership', function () {
      run(function () {
        store.push({ data: array });
      });
      var people;

      run(function () {
        people = store.filter('person', function (hash) {
          if (hash.get('name').match(/Katz$/)) {
            return true;
          }
        });
      });

      run(function () {
        equal(get(people, 'length'), 1, 'precond - one item is in the RecordArray');
      });

      var person = people.objectAt(0);

      equal(get(person, 'name'), 'Scumbag Katz', 'precond - the item is correct');

      run(function () {
        set(person, 'name', 'Yehuda Katz');
      });

      equal(get(people, 'length'), 1, 'there is still one item');
      equal(get(person, 'name'), 'Yehuda Katz', 'it has the updated item');

      run(function () {
        set(person, 'name', 'Yehuda Katz-Foo');
      });

      equal(get(people, 'query'), null, 'expected no query object set');
      equal(get(people, 'length'), 0, 'there are now no items');
    });

    test('when a DS.Model updates its relationships, its changes affect its filtered Array membership', function () {
      run(function () {
        store.push({ data: array });
      });
      var people;

      run(function () {
        people = store.filter('person', function (person) {
          if (person.get('bestFriend') && person.get('bestFriend.name').match(/Katz$/)) {
            return true;
          }
        });
      });

      run(function () {
        equal(get(people, 'length'), 1, 'precond - one item is in the RecordArray');
      });

      var person = people.objectAt(0);

      equal(get(person, 'name'), 'Scumbag Dale', 'precond - the item is correct');

      run(function () {
        set(person, 'bestFriend', null);
      });

      equal(get(people, 'length'), 0, 'there are now 0 items');

      var erik = store.peekRecord('person', 3);
      var yehuda = store.peekRecord('person', 2);
      run(function () {
        erik.set('bestFriend', yehuda);
      });

      person = people.objectAt(0);
      equal(get(people, 'length'), 1, 'there is now 1 item');
      equal(get(person, 'name'), 'Scumbag Bryn', 'precond - the item is correct');
    });

    test('a record array can have a filter on it', function () {
      run(function () {
        store.push({ data: array });
      });
      var recordArray;

      run(function () {
        recordArray = store.filter('person', function (hash) {
          if (hash.get('name').match(/Scumbag [KD]/)) {
            return true;
          }
        });
      });

      equal(get(recordArray, 'length'), 2, 'The Record Array should have the filtered objects on it');

      run(function () {
        store.push({
          data: [{
            id: '4',
            type: 'person',
            attributes: {
              name: 'Scumbag Koz'
            }
          }]
        });
      });

      equal(get(recordArray, 'length'), 3, 'The Record Array should be updated as new items are added to the store');

      run(function () {
        store.push({
          data: [{
            id: '1',
            type: 'person',
            attributes: {
              name: 'Scumbag Tom'
            }
          }]
        });
      });

      equal(get(recordArray, 'length'), 2, 'The Record Array should be updated as existing members are updated');
    });

    test('a filtered record array includes created elements', function () {
      run(function () {
        store.push({ data: array });
      });
      var recordArray;

      run(function () {
        recordArray = store.filter('person', function (hash) {
          if (hash.get('name').match(/Scumbag [KD]/)) {
            return true;
          }
        });
      });

      equal(get(recordArray, 'length'), 2, 'precond - The Record Array should have the filtered objects on it');

      run(function () {
        store.createRecord('person', { name: 'Scumbag Koz' });
      });

      equal(get(recordArray, 'length'), 3, 'The record array has the new object on it');
    });

    test('a Record Array can update its filter', function () {
      customAdapter(env, DS.Adapter.extend({
        deleteRecord: function (store, type, snapshot) {
          return Ember.RSVP.resolve();
        }
      }));

      run(function () {
        store.push({ data: array });
      });

      var dickens = run(function () {
        var record = store.createRecord('person', { id: 4, name: 'Scumbag Dickens' });
        record.deleteRecord();
        return record;
      });
      var asyncDale, asyncKatz, asyncBryn;

      run(function () {
        asyncDale = store.findRecord('person', 1);
        asyncKatz = store.findRecord('person', 2);
        asyncBryn = store.findRecord('person', 3);
      });

      store.filter('person', function (hash) {
        if (hash.get('name').match(/Scumbag [KD]/)) {
          return true;
        }
      }).then(async(function (recordArray) {

        Ember.RSVP.hash({ dale: asyncDale, katz: asyncKatz, bryn: asyncBryn }).then(async(function (records) {
          shouldContain(recordArray, records.dale);
          shouldContain(recordArray, records.katz);
          shouldNotContain(recordArray, records.bryn);
          shouldNotContain(recordArray, dickens);

          Ember.run(function () {
            recordArray.set('filterFunction', function (hash) {
              if (hash.get('name').match(/Katz/)) {
                return true;
              }
            });
          });

          equal(get(recordArray, 'length'), 1, 'The Record Array should have one object on it');

          Ember.run(function () {
            store.push({
              data: [{
                id: '5',
                type: 'person',
                attributes: {
                  name: 'Other Katz'
                }
              }]
            });
          });

          equal(get(recordArray, 'length'), 2, 'The Record Array now has the new object matching the filter');

          Ember.run(function () {
            store.push({
              data: [{
                id: '6',
                type: 'person',
                attributes: {
                  name: 'Scumbag Demon'
                }
              }]
            });
          });

          equal(get(recordArray, 'length'), 2, 'The Record Array doesn\'t have objects matching the old filter');
        }));
      }));
    });

    test('a Record Array can update its filter and notify array observers', function () {
      customAdapter(env, DS.Adapter.extend({
        deleteRecord: function (store, type, snapshot) {
          return Ember.RSVP.resolve();
        }
      }));

      run(function () {
        store.push({ data: array });
      });
      var dickens;

      run(function () {
        dickens = store.createRecord('person', { id: 4, name: 'Scumbag Dickens' });
        dickens.deleteRecord();
      });

      var asyncDale, asyncKatz, asyncBryn;

      run(function () {
        asyncDale = store.findRecord('person', 1);
        asyncKatz = store.findRecord('person', 2);
        asyncBryn = store.findRecord('person', 3);
      });

      store.filter('person', function (hash) {
        if (hash.get('name').match(/Scumbag [KD]/)) {
          return true;
        }
      }).then(async(function (recordArray) {

        var didChangeIdx;
        var didChangeRemoved = 0;
        var didChangeAdded = 0;

        var arrayObserver = {
          arrayWillChange: Ember.K,

          arrayDidChange: function (array, idx, removed, added) {
            didChangeIdx = idx;
            didChangeRemoved += removed;
            didChangeAdded += added;
          }
        };

        recordArray.addArrayObserver(arrayObserver);

        Ember.run(function () {
          recordArray.set('filterFunction', function (hash) {
            if (hash.get('name').match(/Katz/)) {
              return true;
            }
          });
        });

        Ember.RSVP.all([asyncDale, asyncKatz, asyncBryn]).then(async(function () {
          equal(didChangeRemoved, 1, 'removed one item from array');
          didChangeRemoved = 0;

          Ember.run(function () {
            store.push({
              data: [{
                id: '5',
                type: 'person',
                attributes: {
                  name: 'Other Katz'
                }
              }]
            });
          });

          equal(didChangeAdded, 1, 'one item was added');
          didChangeAdded = 0;

          equal(recordArray.objectAt(didChangeIdx).get('name'), 'Other Katz');

          Ember.run(function () {
            store.push({
              data: [{
                id: '6',
                type: 'person',
                attributes: {
                  name: 'Scumbag Demon'
                }
              }]
            });
          });

          equal(didChangeAdded, 0, 'did not get called when an object that doesn\'t match is added');

          Ember.run(function () {
            recordArray.set('filterFunction', function (hash) {
              if (hash.get('name').match(/Scumbag [KD]/)) {
                return true;
              }
            });
          });

          equal(didChangeAdded, 2, 'one item is added when going back');
          equal(recordArray.objectAt(didChangeIdx).get('name'), 'Scumbag Demon');
          equal(recordArray.objectAt(didChangeIdx - 1).get('name'), 'Scumbag Dale');
        }));
      }));
    });

    test('it is possible to filter by computed properties', function () {
      Person.reopen({
        name: DS.attr('string'),
        upperName: Ember.computed(function () {
          return this.get('name').toUpperCase();
        }).property('name')
      });
      var filter;

      run(function () {
        filter = store.filter('person', function (person) {
          return person.get('upperName') === 'TOM DALE';
        });
      });

      equal(filter.get('length'), 0, 'precond - the filter starts empty');

      run(function () {
        store.push({
          data: [{
            id: '1',
            type: 'person',
            attributes: {
              name: 'Tom Dale'
            }
          }]
        });
      });

      equal(filter.get('length'), 1, 'the filter now has a record in it');

      store.findRecord('person', 1).then(async(function (person) {
        Ember.run(function () {
          person.set('name', 'Yehuda Katz');
        });

        equal(filter.get('length'), 0, 'the filter is empty again');
      }));
    });

    test('a filter created after a record is already loaded works', function () {
      Person.reopen({
        name: DS.attr('string'),
        upperName: Ember.computed(function () {
          return this.get('name').toUpperCase();
        }).property('name')
      });

      run(function () {
        store.push({
          data: [{
            id: '1',
            type: 'person',
            attributes: {
              name: 'Tom Dale'
            }
          }]
        });
      });
      var filter;

      run(function () {
        filter = store.filter('person', function (person) {
          return person.get('upperName') === 'TOM DALE';
        });
      });

      equal(filter.get('length'), 1, 'the filter now has a record in it');
      asyncEqual(filter.objectAt(0), store.findRecord('person', 1));
    });

    test('filter with query persists query on the resulting filteredRecordArray', function () {
      customAdapter(env, DS.Adapter.extend({
        query: function (store, type, id) {
          return Ember.RSVP.resolve([{
            id: id,
            name: 'Tom Dale'
          }]);
        }
      }));

      var filter;

      run(function () {
        filter = store.filter('person', { foo: 1 }, function (person) {
          return true;
        });
      });

      Ember.run(function () {
        filter.then(function (array) {
          deepEqual(get(array, 'query'), { foo: 1 }, 'has expected query');
        });
      });
    });

    test('it is possible to filter by state flags', function () {
      var filter;

      customAdapter(env, DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.resolve({ id: id, name: 'Tom Dale' });
        }
      }));

      run(function () {
        filter = store.filter('person', function (person) {
          return person.get('isLoaded');
        });
      });

      equal(filter.get('length'), 0, 'precond - there are no records yet');

      Ember.run(function () {
        var asyncPerson = store.findRecord('person', 1);

        // Ember.run will block `find` from being synchronously
        // resolved in test mode

        equal(filter.get('length'), 0, 'the unloaded record isn\'t in the filter');

        asyncPerson.then(async(function (person) {
          equal(filter.get('length'), 1, 'the now-loaded record is in the filter');
          asyncEqual(filter.objectAt(0), store.findRecord('person', 1));
        }));
      });
    });

    test('it is possible to filter loaded records by dirtiness', function () {
      customAdapter(env, DS.Adapter.extend({
        updateRecord: function () {
          return Ember.RSVP.resolve();
        }
      }));

      var filter = store.filter('person', function (person) {
        return !person.get('hasDirtyAttributes');
      });

      run(function () {
        store.push({
          data: [{
            id: '1',
            type: 'person',
            attributes: {
              name: 'Tom Dale'
            }
          }]
        });
      });

      store.findRecord('person', 1).then(async(function (person) {
        equal(filter.get('length'), 1, 'the clean record is in the filter');

        // Force synchronous update of the filter, even though
        // we're already inside a run loop
        Ember.run(function () {
          person.set('name', 'Yehuda Katz');
        });

        equal(filter.get('length'), 0, 'the now-dirty record is not in the filter');

        return person.save();
      })).then(async(function (person) {
        equal(filter.get('length'), 1, 'the clean record is back in the filter');
      }));
    });

    test('it is possible to filter created records by dirtiness', function () {
      run(function () {
        customAdapter(env, DS.Adapter.extend({
          createRecord: function () {
            return Ember.RSVP.resolve();
          }
        }));
      });

      var filter;

      run(function () {
        filter = store.filter('person', function (person) {
          return !person.get('hasDirtyAttributes');
        });
      });

      var person;

      run(function () {
        person = store.createRecord('person', {
          id: 1,
          name: 'Tom Dale'
        });
      });

      equal(filter.get('length'), 0, 'the dirty record is not in the filter');

      run(function () {
        person.save().then(function (person) {
          equal(filter.get('length'), 1, 'the clean record is in the filter');
        });
      });
    });

    test('it is possible to filter created records by isReloading', function () {
      customAdapter(env, DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.resolve({
            id: 1,
            name: 'Tom Dalle'
          });
        }
      }));

      var filter = store.filter('person', function (person) {
        return !person.get('isReloading');
      });

      var person = store.createRecord('person', {
        id: 1,
        name: 'Tom Dale'
      });

      person.reload().then(async(function (person) {
        equal(filter.get('length'), 1, 'the filter correctly returned a reloaded object');
      }));
    });

    // SERVER SIDE TESTS
    var edited;

    var clientEdits = function (ids) {
      edited = [];

      ids.forEach(function (id) {
        // wrap in an Ember.run to guarantee coalescence of the
        // iterated `set` calls and promise resolution.
        Ember.run(function () {
          store.findRecord('person', id).then(function (person) {
            edited.push(person);
            person.set('name', 'Client-side ' + id);
          });
        });
      });
    };

    var clientCreates = function (names) {
      edited = [];

      // wrap in an Ember.run to guarantee coalescence of the
      // iterated `set` calls.
      Ember.run(function () {
        names.forEach(function (name) {
          edited.push(store.createRecord('person', { name: 'Client-side ' + name }));
        });
      });
    };

    var serverResponds = function () {
      edited.forEach(function (person) {
        run(person, 'save');
      });
    };

    var setup = function (serverCallbacks) {
      run(function () {
        customAdapter(env, DS.Adapter.extend(serverCallbacks));

        store.push({ data: array });

        recordArray = store.filter('person', function (hash) {
          if (hash.get('name').match(/Scumbag/)) {
            return true;
          }
        });
      });

      equal(get(recordArray, 'length'), 3, 'The filter function should work');
    };

    test('a Record Array can update its filter after server-side updates one record', function () {
      setup({
        updateRecord: function (store, type, snapshot) {
          return Ember.RSVP.resolve({ id: 1, name: 'Scumbag Server-side Dale' });
        }
      });

      clientEdits([1]);
      equal(get(recordArray, 'length'), 2, 'The record array updates when the client changes records');

      serverResponds();
      equal(get(recordArray, 'length'), 3, 'The record array updates when the server changes one record');
    });

    test('a Record Array can update its filter after server-side updates multiple records', function () {
      setup({
        updateRecord: function (store, type, snapshot) {
          switch (snapshot.id) {
            case '1':
              return Ember.RSVP.resolve({ id: 1, name: 'Scumbag Server-side Dale' });
            case '2':
              return Ember.RSVP.resolve({ id: 2, name: 'Scumbag Server-side Katz' });
          }
        }
      });

      clientEdits([1, 2]);
      equal(get(recordArray, 'length'), 1, 'The record array updates when the client changes records');

      serverResponds();
      equal(get(recordArray, 'length'), 3, 'The record array updates when the server changes multiple records');
    });

    test('a Record Array can update its filter after server-side creates one record', function () {
      setup({
        createRecord: function (store, type, snapshot) {
          return Ember.RSVP.resolve({ id: 4, name: 'Scumbag Server-side Tim' });
        }
      });

      clientCreates(['Tim']);
      equal(get(recordArray, 'length'), 3, 'The record array does not include non-matching records');

      serverResponds();
      equal(get(recordArray, 'length'), 4, 'The record array updates when the server creates a record');
    });

    test('a Record Array can update its filter after server-side creates multiple records', function () {
      setup({
        createRecord: function (store, type, snapshot) {
          switch (snapshot.attr('name')) {
            case 'Client-side Mike':
              return Ember.RSVP.resolve({ id: 4, name: 'Scumbag Server-side Mike' });
            case 'Client-side David':
              return Ember.RSVP.resolve({ id: 5, name: 'Scumbag Server-side David' });
          }
        }
      });

      clientCreates(['Mike', 'David']);
      equal(get(recordArray, 'length'), 3, 'The record array does not include non-matching records');

      serverResponds();
      equal(get(recordArray, 'length'), 5, 'The record array updates when the server creates multiple records');
    });

    test('a Record Array can update its filter after server-side creates multiple records', function () {
      setup({
        createRecord: function (store, type, snapshot) {
          switch (snapshot.attr('name')) {
            case 'Client-side Mike':
              return Ember.RSVP.resolve({ id: 4, name: 'Scumbag Server-side Mike' });
            case 'Client-side David':
              return Ember.RSVP.resolve({ id: 5, name: 'Scumbag Server-side David' });
          }
        }
      });

      clientCreates(['Mike', 'David']);
      equal(get(recordArray, 'length'), 3, 'The record array does not include non-matching records');

      serverResponds();
      equal(get(recordArray, 'length'), 5, 'The record array updates when the server creates multiple records');
    });

    test('destroying filteredRecordArray unregisters models from being filtered', function () {
      var filterFn = tapFn(function () {
        return true;
      });
      run(function () {
        store.push({
          data: [{
            id: '1',
            type: 'person',
            attributes: {
              name: 'Tom Dale'
            }
          }]
        });
      });

      var recordArray;

      run(function () {
        recordArray = store.filter('person', filterFn);
      });

      equal(filterFn.summary.called.length, 1);

      Ember.run(function () {
        recordArray.then(function (array) {
          array.destroy();
        });
      });
      clientEdits([1]);

      equal(filterFn.summary.called.length, 1, 'expected the filter function not being called anymore');
    });
  }
);


define(
  "ember-data/tests/integration/inverse-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, User, Job, ReflexiveModel;

    var attr = DS.attr;
    var belongsTo = DS.belongsTo;
    var run = Ember.run;

    function stringify(string) {
      return function () {
        return string;
      };
    }

    module('integration/inverse_test - inverseFor', {
      setup: function () {
        User = DS.Model.extend({
          name: attr('string'),
          bestFriend: belongsTo('user', { async: true, inverse: null }),
          job: belongsTo('job', { async: false })
        });

        User.toString = stringify('user');

        Job = DS.Model.extend({
          isGood: attr(),
          user: belongsTo('user', { async: false })
        });

        Job.toString = stringify('job');

        ReflexiveModel = DS.Model.extend({
          reflexiveProp: belongsTo('reflexive-model', { async: false })
        });

        ReflexiveModel.toString = stringify('reflexiveModel');

        env = setupStore({
          user: User,
          job: Job,
          reflexiveModel: ReflexiveModel
        });

        store = env.store;

        Job = store.modelFor('job');
        User = store.modelFor('user');
        ReflexiveModel = store.modelFor('reflexive-model');
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    test('Finds the inverse when there is only one possible available', function () {
      //Maybe store is evaluated lazily, so we need this :(
      run(store, 'push', 'user', { id: 1 });

      deepEqual(Job.inverseFor('user', store), {
        type: User,
        name: 'job',
        kind: 'belongsTo'
      }, 'Gets correct type, name and kind');
    });

    test('Finds the inverse when only one side has defined it manually', function () {
      Job.reopen({
        owner: belongsTo('user', { inverse: 'previousJob', async: false })
      });

      User.reopen({
        previousJob: belongsTo('job', { async: false })
      });

      //Maybe store is evaluated lazily, so we need this :(
      var user, job;
      run(function () {
        user = store.push('user', { id: 1 });
        job = store.push('user', { id: 1 });
      });

      deepEqual(Job.inverseFor('owner', store), {
        type: User, //the model's type
        name: 'previousJob', //the models relationship key
        kind: 'belongsTo'
      }, 'Gets correct type, name and kind');

      deepEqual(User.inverseFor('previousJob', store), {
        type: Job, //the model's type
        name: 'owner', //the models relationship key
        kind: 'belongsTo'
      }, 'Gets correct type, name and kind');
    });

    test('Returns null if inverse relationship it is manually set with a different relationship key', function () {
      Job.reopen({
        user: belongsTo('user', { inverse: 'previousJob', async: false })
      });

      User.reopen({
        job: belongsTo('job', { async: false })
      });
      //Maybe store is evaluated lazily, so we need this :(
      var user;
      run(function () {
        user = store.push('user', { id: 1 });
      });

      equal(User.inverseFor('job', store), null, 'There is no inverse');
    });

    test('Errors out if you define 2 inverses to the same model', function () {
      Job.reopen({
        user: belongsTo('user', { inverse: 'job', async: false }),
        owner: belongsTo('user', { inverse: 'job', async: false })
      });

      User.reopen({
        job: belongsTo('job', { async: false })
      });

      //Maybe store is evaluated lazily, so we need this :(
      expectAssertion(function () {
        run(function () {
          store.push('user', { id: 1 });
        });
        User.inverseFor('job', store);
      }, 'You defined the \'job\' relationship on user, but you defined the inverse relationships of type job multiple times. Look at http://emberjs.com/guides/models/defining-models/#toc_explicit-inverses for how to explicitly specify inverses');
    });

    test('Caches findInverseFor return value', function () {
      expect(1);
      //Maybe store is evaluated lazily, so we need this :(
      run(function () {
        store.push('user', { id: 1 });
      });

      var inverseForUser = Job.inverseFor('user', store);
      Job.findInverseFor = function () {
        ok(false, 'Find is not called anymore');
      };

      equal(inverseForUser, Job.inverseFor('user', store), 'Inverse cached succesfully');
    });

    test('Errors out if you do not define an inverse for a reflexive relationship', function () {

      //Maybe store is evaluated lazily, so we need this :(
      warns(function () {
        var reflexiveModel;
        run(function () {
          reflexiveModel = store.push('reflexive-model', { id: 1 });
          reflexiveModel.get('reflexiveProp');
        });
      }, /Detected a reflexive relationship by the name of 'reflexiveProp'/);
    });
  }
);


define(
  "ember-data/tests/integration/lifecycle-hooks-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Person, env;
    var attr = DS.attr;
    var resolve = Ember.RSVP.resolve;
    var run = Ember.run;

    module('integration/lifecycle_hooks - Lifecycle Hooks', {
      setup: function () {
        Person = DS.Model.extend({
          name: attr('string')
        });

        env = setupStore({
          person: Person
        });
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    asyncTest('When the adapter acknowledges that a record has been created, a `didCreate` event is triggered.', function () {
      expect(3);

      env.adapter.createRecord = function (store, type, snapshot) {
        return resolve({ id: 99, name: 'Yehuda Katz' });
      };
      var person;

      run(function () {
        person = env.store.createRecord('person', { name: 'Yehuda Katz' });
      });

      person.on('didCreate', function () {
        equal(this, person, 'this is bound to the record');
        equal(this.get('id'), '99', 'the ID has been assigned');
        equal(this.get('name'), 'Yehuda Katz', 'the attribute has been assigned');
        start();
      });

      run(person, 'save');
    });

    test('When the adapter acknowledges that a record has been created without a new data payload, a `didCreate` event is triggered.', function () {
      expect(3);

      env.adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.resolve();
      };
      var person;

      run(function () {
        person = env.store.createRecord('person', { id: 99, name: 'Yehuda Katz' });
      });

      person.on('didCreate', function () {
        equal(this, person, 'this is bound to the record');
        equal(this.get('id'), '99', 'the ID has been assigned');
        equal(this.get('name'), 'Yehuda Katz', 'the attribute has been assigned');
      });

      run(person, 'save');
    });
  }
);


define(
  "ember-data/tests/integration/multiple_stores_test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env;
    var SuperVillain, HomePlanet, EvilMinion;
    var run = Ember.run;

    module('integration/multiple_stores - Multiple Stores Tests', {
      setup: function () {
        SuperVillain = DS.Model.extend({
          firstName: DS.attr('string'),
          lastName: DS.attr('string'),
          homePlanet: DS.belongsTo('home-planet', { inverse: 'villains', async: false }),
          evilMinions: DS.hasMany('evil-minion', { async: false })
        });
        HomePlanet = DS.Model.extend({
          name: DS.attr('string'),
          villains: DS.hasMany('super-villain', { inverse: 'homePlanet', async: false })
        });
        EvilMinion = DS.Model.extend({
          superVillain: DS.belongsTo('super-villain', { async: false }),
          name: DS.attr('string')
        });

        env = setupStore({
          superVillain: SuperVillain,
          homePlanet: HomePlanet,
          evilMinion: EvilMinion
        });

        env.registry.register('adapter:application', DS.RESTAdapter);
        env.registry.register('serializer:application', DS.RESTSerializer);

        env.registry.register('store:store-a', DS.Store);
        env.registry.register('store:store-b', DS.Store);

        env.store_a = env.container.lookup('store:store-a');
        env.store_b = env.container.lookup('store:store-b');
      },

      teardown: function () {
        run(env.store, 'destroy');
      }
    });

    test('should be able to push into multiple stores', function () {
      var home_planet_main = { id: '1', name: 'Earth' };
      var home_planet_a = { id: '1', name: 'Mars' };
      var home_planet_b = { id: '1', name: 'Saturn' };

      run(function () {
        env.store.push(env.store.normalize('home-planet', home_planet_main));
        env.store_a.push(env.store_a.normalize('home-planet', home_planet_a));
        env.store_b.push(env.store_b.normalize('home-planet', home_planet_b));
      });

      run(env.store, 'find', 'home-planet', 1).then(async(function (homePlanet) {
        equal(homePlanet.get('name'), 'Earth');
      }));

      run(env.store_a, 'find', 'home-planet', 1).then(async(function (homePlanet) {
        equal(homePlanet.get('name'), 'Mars');
      }));

      run(env.store_b, 'find', 'home-planet', 1).then(async(function (homePlanet) {
        equal(homePlanet.get('name'), 'Saturn');
      }));
    });

    test('embedded records should be created in multiple stores', function () {
      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' }
        }
      }));

      var serializer_main = env.store.serializerFor('home-planet');
      var serializer_a = env.store_a.serializerFor('home-planet');
      var serializer_b = env.store_b.serializerFor('home-planet');

      var json_hash_main = {
        homePlanet: {
          id: '1',
          name: 'Earth',
          villains: [{
            id: '1',
            firstName: 'Tom',
            lastName: 'Dale'
          }]
        }
      };
      var json_hash_a = {
        homePlanet: {
          id: '1',
          name: 'Mars',
          villains: [{
            id: '1',
            firstName: 'James',
            lastName: 'Murphy'
          }]
        }
      };
      var json_hash_b = {
        homePlanet: {
          id: '1',
          name: 'Saturn',
          villains: [{
            id: '1',
            firstName: 'Jade',
            lastName: 'John'
          }]
        }
      };
      var json_main, json_a, json_b;

      run(function () {
        json_main = serializer_main.normalizeResponse(env.store, env.store.modelFor('home-planet'), json_hash_main, 1, 'findRecord');
        env.store.push(json_main);
        equal(env.store.hasRecordForId('super-villain', '1'), true, 'superVillain should exist in service:store');
      });

      run(function () {
        json_a = serializer_a.normalizeResponse(env.store_a, env.store_a.modelFor('home-planet'), json_hash_a, 1, 'findRecord');
        env.store_a.push(json_a);
        equal(env.store_a.hasRecordForId('super-villain', '1'), true, 'superVillain should exist in store:store-a');
      });

      run(function () {
        json_b = serializer_b.normalizeResponse(env.store_b, env.store_a.modelFor('home-planet'), json_hash_b, 1, 'findRecord');
        env.store_b.push(json_b);
        equal(env.store_b.hasRecordForId('super-villain', '1'), true, 'superVillain should exist in store:store-b');
      });
    });
  }
);


define(
  "ember-data/tests/integration/peek-all-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var run = Ember.run;

    var Person, store, array, moreArray;

    module("integration/peek-all - DS.Store#peekAll()", {
      setup: function () {
        array = [{ id: 1, name: "Scumbag Dale" }, { id: 2, name: "Scumbag Katz" }];
        moreArray = [{ id: 3, name: "Scumbag Bryn" }];
        Person = DS.Model.extend({ name: DS.attr("string") });

        store = createStore({ person: Person });
      },
      teardown: function () {
        run(store, "destroy");
        Person = null;
        array = null;
      }
    });

    test("store.peekAll('person') should return all records and should update with new ones", function () {
      run(function () {
        store.pushMany("person", array);
      });

      var all = store.peekAll("person");
      equal(get(all, "length"), 2);

      run(function () {
        store.pushMany("person", moreArray);
      });

      equal(get(all, "length"), 3);
    });

    test("Calling store.peekAll() multiple times should update immediately inside the runloop", function () {
      expect(3);

      Ember.run(function () {
        equal(get(store.peekAll("person"), "length"), 0, "should initially be empty");
        store.createRecord("person", { name: "Tomster" });
        equal(get(store.peekAll("person"), "length"), 1, "should contain one person");
        store.push("person", { id: 1, name: "Tomster's friend" });
        equal(get(store.peekAll("person"), "length"), 2, "should contain two people");
      });
    });

    test("Calling store.peekAll() after creating a record should return correct data", function () {
      expect(1);

      Ember.run(function () {
        store.createRecord("person", { name: "Tomster" });
        equal(get(store.peekAll("person"), "length"), 1, "should contain one person");
      });
    });
  }
);


define(
  "ember-data/tests/integration/record-array-manager-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var store, env;
    var run = Ember.run;

    var Person = DS.Model.extend({
      name: DS.attr('string'),
      cars: DS.hasMany('car', { async: false })
    });

    Person.toString = function () {
      return 'Person';
    };

    var Car = DS.Model.extend({
      make: DS.attr('string'),
      model: DS.attr('string'),
      person: DS.belongsTo('person', { async: false })
    });

    Car.toString = function () {
      return 'Car';
    };

    var manager;

    module('integration/record_array_manager', {
      setup: function () {
        env = setupStore({
          adapter: DS.RESTAdapter.extend()
        });
        store = env.store;

        manager = store.recordArrayManager;

        env.registry.register('model:car', Car);
        env.registry.register('model:person', Person);
      }
    });

    function tap(obj, methodName, callback) {
      var old = obj[methodName];

      var summary = { called: [] };

      obj[methodName] = function () {
        var result = old.apply(obj, arguments);
        if (callback) {
          callback.apply(obj, arguments);
        }
        summary.called.push(arguments);
        return result;
      };

      return summary;
    }

    test('destroying the store correctly cleans everything up', function () {
      var query = {};
      var person;

      run(function () {
        store.push('car', {
          id: 1,
          make: 'BMC',
          model: 'Mini Cooper',
          person: 1
        });
      });

      run(function () {
        person = store.push('person', {
          id: 1,
          name: 'Tom Dale',
          cars: [1]
        });
      });

      var filterd = manager.createFilteredRecordArray(Person, function () {
        return true;
      });
      var filterd2 = manager.createFilteredRecordArray(Person, function () {
        return true;
      });
      var all = store.peekAll('person');
      var adapterPopulated = manager.createAdapterPopulatedRecordArray(Person, query);

      var filterdSummary = tap(filterd, 'willDestroy');
      var filterd2Summary = tap(filterd2, 'willDestroy');
      var allSummary = tap(all, 'willDestroy');
      var adapterPopulatedSummary = tap(adapterPopulated, 'willDestroy');

      equal(filterdSummary.called.length, 0);
      equal(filterd2Summary.called.length, 0);
      equal(allSummary.called.length, 0);
      equal(adapterPopulatedSummary.called.length, 0);

      equal(person._internalModel._recordArrays.list.length, 3, 'expected the person to be a member of 3 recordArrays');

      Ember.run(filterd2, filterd2.destroy);
      equal(person._internalModel._recordArrays.list.length, 2, 'expected the person to be a member of 2 recordArrays');
      equal(filterd2Summary.called.length, 1);

      equal(manager.liveRecordArrays.has(all.type), true);
      Ember.run(all, all.destroy);
      equal(person._internalModel._recordArrays.list.length, 1, 'expected the person to be a member of 1 recordArrays');
      equal(allSummary.called.length, 1);
      equal(manager.liveRecordArrays.has(all.type), false);

      Ember.run(manager, manager.destroy);
      equal(person._internalModel._recordArrays.list.length, 0, 'expected the person to be a member of no recordArrays');
      equal(filterdSummary.called.length, 1);
      equal(filterd2Summary.called.length, 1);
      equal(allSummary.called.length, 1);
      equal(adapterPopulatedSummary.called.length, 1);
    });

    test('Should not filter a store.peekAll() array when a record property is changed', function () {
      var car;

      var populateLiveRecordArray = tap(store.recordArrayManager, 'populateLiveRecordArray');
      var updateFilterRecordArray = tap(store.recordArrayManager, 'updateFilterRecordArray');

      store.peekAll('car');

      run(function () {
        car = store.push('car', {
          id: 1,
          make: 'BMC',
          model: 'Mini Cooper',
          person: 1
        });
      });

      equal(populateLiveRecordArray.called.length, 1);
      equal(updateFilterRecordArray.called.length, 0);

      run(function () {
        car.set('model', 'Mini');
      });

      equal(populateLiveRecordArray.called.length, 1);
      equal(updateFilterRecordArray.called.length, 0);
    });
  }
);


define(
  "ember-data/tests/integration/records/collection-save-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Post, env;
    var run = Ember.run;

    module("integration/records/collection_save - Save Collection of Records", {
      setup: function () {
        Post = DS.Model.extend({
          title: DS.attr("string")
        });

        Post.toString = function () {
          return "Post";
        };

        env = setupStore({ post: Post });
      },

      teardown: function () {
        run(env.container, "destroy");
      }
    });

    test("Collection will resolve save on success", function () {
      expect(1);
      run(function () {
        env.store.createRecord("post", { title: "Hello" });
        env.store.createRecord("post", { title: "World" });
      });

      var posts = env.store.peekAll("post");

      env.adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.resolve({ id: 123 });
      };

      run(function () {
        posts.save().then(async(function () {
          ok(true, "save operation was resolved");
        }));
      });
    });

    test("Collection will reject save on error", function () {
      run(function () {
        env.store.createRecord("post", { title: "Hello" });
        env.store.createRecord("post", { title: "World" });
      });

      var posts = env.store.peekAll("post");

      env.adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.reject();
      };

      run(function () {
        posts.save().then(function () {}, async(function () {
          ok(true, "save operation was rejected");
        }));
      });
    });

    test("Retry is allowed in a failure handler", function () {
      run(function () {
        env.store.createRecord("post", { title: "Hello" });
        env.store.createRecord("post", { title: "World" });
      });

      var posts = env.store.peekAll("post");

      var count = 0;

      env.adapter.createRecord = function (store, type, snapshot) {
        if (count++ === 0) {
          return Ember.RSVP.reject();
        } else {
          return Ember.RSVP.resolve({ id: 123 });
        }
      };

      env.adapter.updateRecord = function (store, type, snapshot) {
        return Ember.RSVP.resolve({ id: 123 });
      };

      run(function () {
        posts.save().then(function () {}, async(function () {
          return posts.save();
        })).then(async(function (post) {
          equal(posts.get("firstObject.id"), "123", "The post ID made it through");
        }));
      });
    });

    test("Collection will reject save on invalid", function () {
      expect(1);
      run(function () {
        env.store.createRecord("post", { title: "Hello" });
        env.store.createRecord("post", { title: "World" });
      });

      var posts = env.store.peekAll("post");

      env.adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.reject({ title: "invalid" });
      };

      Ember.run(function () {
        posts.save().then(function () {}, function () {
          ok(true, "save operation was rejected");
        });
      });
    });
  }
);


define(
  "ember-data/tests/integration/records/delete-record-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var attr = DS.attr;
    var Person, env;
    var run = Ember.run;

    module("integration/deletedRecord - Deleting Records", {
      setup: function () {
        Person = DS.Model.extend({
          name: attr("string")
        });

        Person.toString = function () {
          return "Person";
        };

        env = setupStore({
          person: Person
        });
      },

      teardown: function () {
        Ember.run(function () {
          env.container.destroy();
        });
      }
    });

    test("records can be deleted during record array enumeration", function () {
      var adam, dave;
      run(function () {
        adam = env.store.push("person", { id: 1, name: "Adam Sunderland" });
        dave = env.store.push("person", { id: 2, name: "Dave Sunderland" });
      });
      var all = env.store.peekAll("person");

      // pre-condition
      equal(all.get("length"), 2, "expected 2 records");

      Ember.run(function () {
        all.forEach(function (record) {
          record.deleteRecord();
        });
      });

      equal(all.get("length"), 0, "expected 0 records");
      equal(all.objectAt(0), null, "can't get any records");
    });

    test("when deleted records are rolled back, they are still in their previous record arrays", function () {
      var jaime, cersei;
      run(function () {
        jaime = env.store.push("person", { id: 1, name: "Jaime Lannister" });
        cersei = env.store.push("person", { id: 2, name: "Cersei Lannister" });
      });
      var all = env.store.peekAll("person");
      var filtered;
      run(function () {
        filtered = env.store.filter("person", function () {
          return true;
        });
      });

      equal(all.get("length"), 2, "precond - we start with two people");
      equal(filtered.get("length"), 2, "precond - we start with two people");

      run(function () {
        jaime.deleteRecord();
        jaime.rollbackAttributes();
      });
      equal(all.get("length"), 2, "record was not removed");
      equal(filtered.get("length"), 2, "record was not removed");
    });
  }
);


define(
  "ember-data/tests/integration/records/load-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var hasMany = DS.hasMany;
    var Post, Comment, env;
    var run = Ember.run;

    module("integration/load - Loading Records", {
      setup: function () {
        Post = DS.Model.extend({
          comments: hasMany({ async: true })
        });

        Comment = DS.Model.extend();

        Post.toString = function () {
          return "Post";
        };
        Comment.toString = function () {
          return "Comment";
        };

        env = setupStore({ post: Post, comment: Comment });
      },

      teardown: function () {
        run(env.container, "destroy");
      }
    });

    test("When loading a record fails, the isLoading is set to false", function () {
      env.adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.reject();
      };

      run(function () {
        env.store.findRecord("post", 1).then(null, async(function () {
          // store.recordForId is private, but there is currently no other way to
          // get the specific record instance, since it is not passed to this
          // rejection handler
          var post = env.store.recordForId("post", 1);

          equal(post.get("isLoading"), false, "post is not loading anymore");
        }));
      });
    });
  }
);


define(
  "ember-data/tests/integration/records/property-changes-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, Person;
    var attr = DS.attr;
    var run = Ember.run;

    module('integration/records/property-changes - Property changes', {
      setup: function () {
        Person = DS.Model.extend({
          firstName: attr('string'),
          lastName: attr('string')
        });
        Person.toString = function () {
          return 'Person';
        };

        env = setupStore({
          person: Person
        });
        store = env.store;
      },

      teardown: function () {
        Ember.run(function () {
          env.container.destroy();
        });
      }
    });

    test('Calling push with partial records trigger observers for just those attributes that changed', function () {
      expect(1);
      var person;

      run(function () {
        person = store.push('person', {
          id: 'wat',
          firstName: 'Yehuda',
          lastName: 'Katz'
        });
      });

      person.addObserver('firstName', function () {
        ok(false, 'firstName observer should not be triggered');
      });

      person.addObserver('lastName', function () {
        ok(true, 'lastName observer should be triggered');
      });

      run(function () {
        store.push('person', {
          id: 'wat',
          firstName: 'Yehuda',
          lastName: 'Katz!'
        });
      });
    });

    test('Calling push does not trigger observers for locally changed attributes with the same value', function () {
      expect(0);
      var person;

      run(function () {
        person = store.push('person', {
          id: 'wat',
          firstName: 'Yehuda',
          lastName: 'Katz'
        });

        person.set('lastName', 'Katz!');
      });

      person.addObserver('firstName', function () {
        ok(false, 'firstName observer should not be triggered');
      });

      person.addObserver('lastName', function () {
        ok(false, 'lastName observer should not be triggered');
      });

      run(function () {
        store.push('person', {
          id: 'wat',
          firstName: 'Yehuda',
          lastName: 'Katz!'
        });
      });
    });

    test('Saving a record trigger observers for locally changed attributes with the same canonical value', function () {
      expect(1);
      var person;

      env.adapter.updateRecord = function (store, type, snapshot) {
        return Ember.RSVP.resolve({ id: 'wat', lastName: 'Katz' });
      };

      run(function () {
        person = store.push('person', {
          id: 'wat',
          firstName: 'Yehuda',
          lastName: 'Katz'
        });

        person.set('lastName', 'Katz!');
      });

      person.addObserver('firstName', function () {
        ok(false, 'firstName observer should not be triggered');
      });

      person.addObserver('lastName', function () {
        ok(true, 'lastName observer should be triggered');
      });

      run(function () {
        person.save();
      });
    });

    test('store.push should not override a modified attribute', function () {
      expect(1);
      var person;

      run(function () {
        person = store.push('person', {
          id: 'wat',
          firstName: 'Yehuda',
          lastName: 'Katz'
        });

        person.set('lastName', 'Katz!');
      });

      person.addObserver('firstName', function () {
        ok(true, 'firstName observer should be triggered');
      });

      person.addObserver('lastName', function () {
        ok(false, 'lastName observer should not be triggered');
      });

      run(function () {
        person = store.push('person', {
          id: 'wat',
          firstName: 'Tom',
          lastName: 'Dale'
        });
      });
    });
  }
);


define(
  "ember-data/tests/integration/records/reload-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var attr = DS.attr;
    var Person, env;
    var run = Ember.run;

    module('integration/reload - Reloading Records', {
      setup: function () {
        Person = DS.Model.extend({
          updatedAt: attr('string'),
          name: attr('string'),
          firstName: attr('string'),
          lastName: attr('string')
        });

        Person.toString = function () {
          return 'Person';
        };

        env = setupStore({ person: Person });
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    test('When a single record is requested, the adapter\'s find method should be called unless it\'s loaded.', function () {
      var count = 0;

      env.adapter.findRecord = function (store, type, id, snapshot) {
        if (count === 0) {
          count++;
          return Ember.RSVP.resolve({ id: id, name: 'Tom Dale' });
        } else if (count === 1) {
          count++;
          return Ember.RSVP.resolve({ id: id, name: 'Braaaahm Dale' });
        } else {
          ok(false, 'Should not get here');
        }
      };

      run(function () {
        env.store.findRecord('person', 1).then(function (person) {
          equal(get(person, 'name'), 'Tom Dale', 'The person is loaded with the right name');
          equal(get(person, 'isLoaded'), true, 'The person is now loaded');
          var promise = person.reload();
          equal(get(person, 'isReloading'), true, 'The person is now reloading');
          return promise;
        }).then(function (person) {
          equal(get(person, 'isReloading'), false, 'The person is no longer reloading');
          equal(get(person, 'name'), 'Braaaahm Dale', 'The person is now updated with the right name');
        });
      });
    });

    test('When a record is reloaded and fails, it can try again', function () {
      var tom;
      run(function () {
        tom = env.store.push('person', { id: 1, name: 'Tom Dale' });
      });

      var count = 0;
      env.adapter.findRecord = function (store, type, id, snapshot) {
        equal(tom.get('isReloading'), true, 'Tom is reloading');
        if (count++ === 0) {
          return Ember.RSVP.reject();
        } else {
          return Ember.RSVP.resolve({ id: 1, name: 'Thomas Dale' });
        }
      };

      run(function () {
        tom.reload().then(null, function () {
          equal(tom.get('isError'), true, 'Tom is now errored');
          equal(tom.get('isReloading'), false, 'Tom is no longer reloading');
          return tom.reload();
        }).then(function (person) {
          equal(person, tom, 'The resolved value is the record');
          equal(tom.get('isError'), false, 'Tom is no longer errored');
          equal(tom.get('isReloading'), false, 'Tom is no longer reloading');
          equal(tom.get('name'), 'Thomas Dale', 'the updates apply');
        });
      });
    });

    test('When a record is loaded a second time, isLoaded stays true', function () {
      run(function () {
        env.store.push('person', { id: 1, name: 'Tom Dale' });
      });

      run(function () {
        env.store.findRecord('person', 1).then(function (person) {
          equal(get(person, 'isLoaded'), true, 'The person is loaded');
          person.addObserver('isLoaded', isLoadedDidChange);

          // Reload the record
          env.store.push('person', { id: 1, name: 'Tom Dale' });
          equal(get(person, 'isLoaded'), true, 'The person is still loaded after load');

          person.removeObserver('isLoaded', isLoadedDidChange);
        });
      });

      function isLoadedDidChange() {
        // This shouldn't be hit
        equal(get(this, 'isLoaded'), true, 'The person is still loaded after change');
      }
    });

    test('When a record is reloaded, its async hasMany relationships still work', function () {
      env.registry.register('model:person', DS.Model.extend({
        name: DS.attr(),
        tags: DS.hasMany('tag', { async: true })
      }));

      env.registry.register('model:tag', DS.Model.extend({
        name: DS.attr()
      }));

      var tags = { 1: 'hipster', 2: 'hair' };

      env.adapter.findRecord = function (store, type, id, snapshot) {
        switch (type.modelName) {
          case 'person':
            return Ember.RSVP.resolve({ id: 1, name: 'Tom', tags: [1, 2] });
          case 'tag':
            return Ember.RSVP.resolve({ id: id, name: tags[id] });
        }
      };

      var tom;

      run(function () {
        env.store.findRecord('person', 1).then(function (person) {
          tom = person;
          equal(person.get('name'), 'Tom', 'precond');

          return person.get('tags');
        }).then(function (tags) {
          deepEqual(tags.mapBy('name'), ['hipster', 'hair']);

          return tom.reload();
        }).then(function (person) {
          equal(person.get('name'), 'Tom', 'precond');

          return person.get('tags');
        }).then(function (tags) {
          deepEqual(tags.mapBy('name'), ['hipster', 'hair'], 'The tags are still there');
        });
      });
    });
  }
);


define(
  "ember-data/tests/integration/records/save-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Post, env;
    var run = Ember.run;

    module("integration/records/save - Save Record", {
      setup: function () {
        Post = DS.Model.extend({
          title: DS.attr("string")
        });

        Post.toString = function () {
          return "Post";
        };

        env = setupStore({ post: Post });
      },

      teardown: function () {
        run(env.container, "destroy");
      }
    });

    test("Will resolve save on success", function () {
      expect(4);
      var post;
      run(function () {
        post = env.store.createRecord("post", { title: "toto" });
      });

      var deferred = Ember.RSVP.defer();
      env.adapter.createRecord = function (store, type, snapshot) {
        return deferred.promise;
      };

      run(function () {
        var saved = post.save();

        // `save` returns a PromiseObject which allows to call get on it
        equal(saved.get("id"), undefined);

        deferred.resolve({ id: 123 });
        saved.then(function (model) {
          ok(true, "save operation was resolved");
          equal(saved.get("id"), 123);
          equal(model, post, "resolves with the model");
        });
      });
    });

    test("Will reject save on error", function () {
      var post;
      run(function () {
        post = env.store.createRecord("post", { title: "toto" });
      });

      env.adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.reject();
      };

      run(function () {
        post.save().then(function () {}, function () {
          ok(true, "save operation was rejected");
        });
      });
    });

    test("Retry is allowed in a failure handler", function () {
      var post;
      run(function () {
        post = env.store.createRecord("post", { title: "toto" });
      });

      var count = 0;

      env.adapter.createRecord = function (store, type, snapshot) {
        if (count++ === 0) {
          return Ember.RSVP.reject();
        } else {
          return Ember.RSVP.resolve({ id: 123 });
        }
      };

      run(function () {
        post.save().then(function () {}, function () {
          return post.save();
        }).then(function (post) {
          equal(post.get("id"), "123", "The post ID made it through");
        });
      });
    });

    test("Repeated failed saves keeps the record in uncommited state", function () {
      expect(2);
      var post;

      run(function () {
        post = env.store.createRecord("post", { title: "toto" });
      });

      env.adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.reject();
      };

      run(function () {
        post.save().then(null, function () {
          equal(post.get("currentState.stateName"), "root.loaded.created.uncommitted");

          post.save().then(null, function () {
            equal(post.get("currentState.stateName"), "root.loaded.created.uncommitted");
          });
        });
      });
    });

    test("Will reject save on invalid", function () {
      expect(1);
      var post;
      run(function () {
        post = env.store.createRecord("post", { title: "toto" });
      });

      env.adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.reject({ title: "invalid" });
      };

      run(function () {
        post.save().then(function () {}, function () {
          ok(true, "save operation was rejected");
        });
      });
    });
  }
);


define(
  "ember-data/tests/integration/records/unload-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var attr = DS.attr;
    var belongsTo = DS.belongsTo;
    var hasMany = DS.hasMany;
    var run = Ember.run;
    var env;

    var Person = DS.Model.extend({
      name: attr('string'),
      cars: hasMany('car', { async: false })
    });

    Person.toString = function () {
      return 'Person';
    };

    var Group = DS.Model.extend({
      people: hasMany('person', { async: false })
    });

    Group.toString = function () {
      return 'Group';
    };

    var Car = DS.Model.extend({
      make: attr('string'),
      model: attr('string'),
      person: belongsTo('person', { async: false })
    });

    Car.toString = function () {
      return 'Car';
    };

    module('integration/unload - Unloading Records', {
      setup: function () {
        env = setupStore({
          person: Person,
          car: Car,
          group: Group
        });
      },

      teardown: function () {
        Ember.run(function () {
          env.container.destroy();
        });
      }
    });

    test('can unload a single record', function () {
      var adam;
      run(function () {
        adam = env.store.push('person', { id: 1, name: 'Adam Sunderland' });
      });

      Ember.run(function () {
        adam.unloadRecord();
      });

      equal(env.store.peekAll('person').get('length'), 0);
    });

    test('can unload all records for a given type', function () {
      expect(2);

      var adam, bob, dudu;
      run(function () {
        adam = env.store.push('person', { id: 1, name: 'Adam Sunderland' });
        bob = env.store.push('person', { id: 2, name: 'Bob Bobson' });

        dudu = env.store.push('car', {
          id: 1,
          make: 'VW',
          model: 'Beetle',
          person: 1
        });
      });

      Ember.run(function () {
        env.store.unloadAll('person');
      });

      equal(env.store.peekAll('person').get('length'), 0);
      equal(env.store.peekAll('car').get('length'), 1);
    });

    test('can unload all records', function () {
      expect(2);

      var adam, bob, dudu;
      run(function () {
        adam = env.store.push('person', { id: 1, name: 'Adam Sunderland' });
        bob = env.store.push('person', { id: 2, name: 'Bob Bobson' });

        dudu = env.store.push('car', {
          id: 1,
          make: 'VW',
          model: 'Beetle',
          person: 1
        });
      });

      Ember.run(function () {
        env.store.unloadAll();
      });

      equal(env.store.peekAll('person').get('length'), 0);
      equal(env.store.peekAll('car').get('length'), 0);
    });

    test('Unloading all records for a given type clears saved meta data.', function () {

      function metadataKeys(type) {
        return Object.keys(env.store.metadataFor(type));
      }

      run(function () {
        env.store.setMetadataFor('person', { count: 10 });
      });

      Ember.run(function () {
        env.store.unloadAll('person');
      });

      deepEqual(metadataKeys('person'), [], 'Metadata for person is empty');
    });

    test('removes findAllCache after unloading all records', function () {
      var adam, bob;
      run(function () {
        adam = env.store.push('person', { id: 1, name: 'Adam Sunderland' });
        bob = env.store.push('person', { id: 2, name: 'Bob Bobson' });
      });

      Ember.run(function () {
        env.store.peekAll('person');
        env.store.unloadAll('person');
      });

      equal(env.store.peekAll('person').get('length'), 0);
    });

    test('unloading all records also updates record array from peekAll()', function () {
      var adam, bob;
      run(function () {
        adam = env.store.push('person', { id: 1, name: 'Adam Sunderland' });
        bob = env.store.push('person', { id: 2, name: 'Bob Bobson' });
      });
      var all = env.store.peekAll('person');

      equal(all.get('length'), 2);

      Ember.run(function () {
        env.store.unloadAll('person');
      });

      equal(all.get('length'), 0);
    });

    test('unloading a record also clears its relationship', function () {
      var adam, bob;
      run(function () {
        adam = env.store.push('person', {
          id: 1,
          name: 'Adam Sunderland',
          cars: [1]
        });
      });

      run(function () {
        bob = env.store.push('car', {
          id: 1,
          make: 'Lotus',
          model: 'Exige',
          person: 1
        });
      });

      run(function () {
        env.store.find('person', 1).then(function (person) {
          equal(person.get('cars.length'), 1, 'The inital length of cars is correct');

          run(function () {
            person.unloadRecord();
          });

          equal(person.get('cars.length'), undefined);
        });
      });
    });

    test('unloading a record also clears the implicit inverse relationships', function () {
      var adam, bob;
      run(function () {
        adam = env.store.push('person', {
          id: 1,
          name: 'Adam Sunderland'
        });
      });

      run(function () {
        bob = env.store.push('group', {
          id: 1,
          people: [1]
        });
      });

      run(function () {
        env.store.find('group', 1).then(function (group) {
          equal(group.get('people.length'), 1, 'The inital length of people is correct');
          var person = env.store.peekRecord('person', 1);
          run(function () {
            person.unloadRecord();
          });

          equal(group.get('people.length'), 0, 'Person was removed from the people array');
        });
      });
    });
  }
);


define(
  "ember-data/tests/integration/relationships/belongs-to-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, User, Message, Post, Contact, Comment, Book, Chapter, Author, NewMessage;
    var get = Ember.get;
    var run = Ember.run;

    var attr = DS.attr;
    var hasMany = DS.hasMany;
    var belongsTo = DS.belongsTo;
    var hash = Ember.RSVP.hash;

    // Before https://github.com/emberjs/ember.js/pull/10323 the computed
    // property descriptor was stored on the ember meta object. After that
    // pr it was moved to the ember object. This code normalized that
    // lookup because the Ember Data ci tests run against diferent version
    // of Ember. Once that code reaches the release branch this code can
    // be removed.
    function getComputedPropertyDesc(model, key) {
      if (Ember.meta(model).descs) {
        return Ember.meta(model).descs[key];
      }
      var possibleDesc = model[key];
      var desc = possibleDesc !== null && typeof possibleDesc === 'object' && possibleDesc.isDescriptor ? possibleDesc : undefined;
      return desc;
    }

    module('integration/relationship/belongs_to Belongs-To Relationships', {
      setup: function () {
        User = DS.Model.extend({
          name: attr('string'),
          messages: hasMany('message', { polymorphic: true, async: false }),
          favouriteMessage: belongsTo('message', { polymorphic: true, inverse: null, async: false })
        });

        Message = DS.Model.extend({
          user: belongsTo('user', { inverse: 'messages', async: false }),
          created_at: attr('date')
        });

        Post = Message.extend({
          title: attr('string'),
          comments: hasMany('comment', { async: false })
        });

        Comment = Message.extend({
          body: DS.attr('string'),
          message: DS.belongsTo('message', { polymorphic: true, async: false })
        });

        Book = DS.Model.extend({
          name: attr('string'),
          author: belongsTo('author', { async: false }),
          chapters: hasMany('chapters', { async: false })
        });

        Chapter = DS.Model.extend({
          title: attr('string'),
          book: belongsTo('book', { async: false })
        });

        Author = DS.Model.extend({
          name: attr('string'),
          books: hasMany('books', { async: false })
        });

        env = setupStore({
          user: User,
          post: Post,
          comment: Comment,
          message: Message,
          book: Book,
          chapter: Chapter,
          author: Author
        });

        env.registry.optionsForType('serializer', { singleton: false });
        env.registry.optionsForType('adapter', { singleton: false });

        env.registry.register('serializer:user', DS.JSONSerializer.extend({
          attrs: {
            favouriteMessage: { embedded: 'always' }
          }
        }));

        store = env.store;

        User = store.modelFor('user');
        Post = store.modelFor('post');
        Comment = store.modelFor('comment');
        Message = store.modelFor('message');
        Book = store.modelFor('book');
        Chapter = store.modelFor('chapter');
        Author = store.modelFor('author');
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    test('The store can materialize a non loaded monomorphic belongsTo association', function () {
      expect(1);

      env.store.modelFor('post').reopen({
        user: DS.belongsTo('user', {
          async: true,
          inverse: 'messages'
        })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        ok(true, 'The adapter\'s find method should be called');
        return Ember.RSVP.resolve({
          id: 1
        });
      };

      run(function () {
        env.store.push({
          data: {
            id: '1',
            type: 'post',
            relationships: {
              user: {
                data: {
                  id: '2',
                  type: 'user'
                }
              }
            }
          }
        });
      });

      run(function () {
        env.store.findRecord('post', 1).then(function (post) {
          post.get('user');
        });
      });
    });

    test('Only a record of the same type can be used with a monomorphic belongsTo relationship', function () {
      expect(1);

      run(function () {
        store.push({
          data: {
            id: '1',
            type: 'post'
          }
        });
        store.push({
          data: {
            id: '2',
            type: 'comment'
          }
        });
      });

      run(function () {
        hash({
          post: store.findRecord('post', 1),
          comment: store.findRecord('comment', 2)
        }).then(function (records) {
          expectAssertion(function () {
            records.post.set('user', records.comment);
          }, /You cannot add a record of type 'comment' to the 'post.user' relationship/);
        });
      });
    });

    test('Only a record of the same base type can be used with a polymorphic belongsTo relationship', function () {
      expect(1);
      run(function () {
        store.push({
          data: [{
            id: '1',
            type: 'comment'
          }, {
            id: '2',
            type: 'comment'
          }]
        });
        store.push({
          data: {
            id: '1',
            type: 'post'
          }
        });
        store.push({
          data: {
            id: '3',
            type: 'user'
          }
        });
      });

      run(function () {
        var asyncRecords = hash({
          user: store.findRecord('user', 3),
          post: store.findRecord('post', 1),
          comment: store.findRecord('comment', 1),
          anotherComment: store.findRecord('comment', 2)
        });

        asyncRecords.then(function (records) {
          var comment = records.comment;

          comment.set('message', records.anotherComment);
          comment.set('message', records.post);
          comment.set('message', null);

          expectAssertion(function () {
            comment.set('message', records.user);
          }, /You cannot add a record of type 'user' to the 'comment.message' relationship \(only 'message' allowed\)/);
        });
      });
    });

    test('The store can load a polymorphic belongsTo association', function () {
      run(function () {
        env.store.push({
          data: {
            id: '1',
            type: 'post'
          }
        });

        env.store.push({
          data: {
            id: '2',
            type: 'comment',
            relationships: {
              message: {
                data: {
                  id: '1',
                  type: 'post'
                }
              }
            }
          }
        });
      });

      run(function () {
        hash({
          message: store.findRecord('post', 1),
          comment: store.findRecord('comment', 2)
        }).then(function (records) {
          equal(records.comment.get('message'), records.message);
        });
      });
    });

    test('The store can serialize a polymorphic belongsTo association', function () {
      var serializerInstance = store.serializerFor('comment');

      serializerInstance.serializePolymorphicType = function (record, json, relationship) {
        ok(true, 'The serializer\'s serializePolymorphicType method should be called');
        json['message_type'] = 'post';
      };
      run(function () {
        env.store.push({
          data: {
            id: '1',
            type: 'post'
          }
        });
        env.store.push({
          data: {
            id: '2',
            type: 'comment',
            relationships: {
              message: {
                data: {
                  id: '1',
                  type: 'post'
                }
              }
            }
          }
        });

        store.findRecord('comment', 2).then(function (comment) {
          var serialized = store.serialize(comment, { includeId: true });
          equal(serialized['message'], 1);
          equal(serialized['message_type'], 'post');
        });
      });
    });

    test('A serializer can materialize a belongsTo as a link that gets sent back to findBelongsTo', function () {
      var Group = DS.Model.extend({
        people: DS.hasMany('person', { async: false })
      });

      var Person = DS.Model.extend({
        group: DS.belongsTo({ async: true })
      });

      env.registry.register('model:group', Group);
      env.registry.register('model:person', Person);

      run(function () {
        store.push({
          data: {
            id: '1',
            type: 'person',
            relationships: {
              group: {
                links: {
                  related: '/people/1/group'
                }
              }
            }
          }
        });
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        throw new Error('Adapter\'s find method should not be called');
      };

      env.adapter.findBelongsTo = async(function (store, snapshot, link, relationship) {
        equal(relationship.type, 'group');
        equal(relationship.key, 'group');
        equal(link, '/people/1/group');

        return Ember.RSVP.resolve({ id: 1, people: [1] });
      });

      run(function () {
        env.store.findRecord('person', 1).then(function (person) {
          return person.get('group');
        }).then(function (group) {
          ok(group instanceof Group, 'A group object is loaded');
          ok(group.get('id') === '1', 'It is the group we are expecting');
        });
      });
    });

    test('A record with an async belongsTo relationship always returns a promise for that relationship', function () {
      var Seat = DS.Model.extend({
        person: DS.belongsTo('person', { async: false })
      });

      var Person = DS.Model.extend({
        seat: DS.belongsTo('seat', { async: true })
      });

      env.registry.register('model:seat', Seat);
      env.registry.register('model:person', Person);

      run(function () {
        store.push({
          data: {
            id: '1',
            type: 'person',
            relationships: {
              seat: {
                links: {
                  related: '/people/1/seat'
                }
              }
            }
          }
        });
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        throw new Error('Adapter\'s find method should not be called');
      };

      env.adapter.findBelongsTo = async(function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve({ id: 1 });
      });

      run(function () {
        env.store.findRecord('person', 1).then(function (person) {
          person.get('seat').then(function (seat) {
            // this assertion fails too
            // ok(seat.get('person') === person, 'parent relationship should be populated');
            seat.set('person', person);
            ok(person.get('seat').then, 'seat should be a PromiseObject');
          });
        });
      });
    });

    test('A record with an async belongsTo relationship returning null should resolve null', function () {
      expect(1);

      var Group = DS.Model.extend({
        people: DS.hasMany('person', { async: false })
      });

      var Person = DS.Model.extend({
        group: DS.belongsTo({ async: true })
      });

      env.registry.register('model:group', Group);
      env.registry.register('model:person', Person);

      run(function () {
        store.push({
          data: {
            id: '1',
            type: 'person',
            relationships: {
              group: {
                links: {
                  related: '/people/1/group'
                }
              }
            }
          }
        });
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        throw new Error('Adapter\'s find method should not be called');
      };

      env.adapter.findBelongsTo = async(function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve(null);
      });

      env.store.findRecord('person', '1').then(async(function (person) {
        return person.get('group');
      })).then(async(function (group) {
        ok(group === null, 'group should be null');
      }));
    });

    test('A record can be created with a resolved belongsTo promise', function () {
      expect(1);

      var Group = DS.Model.extend({
        people: DS.hasMany('person', { async: false })
      });

      var Person = DS.Model.extend({
        group: DS.belongsTo({ async: true })
      });

      env.registry.register('model:group', Group);
      env.registry.register('model:person', Person);

      var group;
      run(function () {
        group = store.push({
          data: {
            id: 1,
            type: 'group'
          }
        });
      });

      var groupPromise = store.findRecord('group', 1);
      groupPromise.then(async(function (group) {
        var person = env.store.createRecord('person', {
          group: groupPromise
        });
        equal(person.get('group.content'), group);
      }));
    });

    test('polymorphic belongsTo type-checks check the superclass when MODEL_FACTORY_INJECTIONS is enabled', function () {
      expect(1);

      var injectionValue = Ember.MODEL_FACTORY_INJECTIONS;
      Ember.MODEL_FACTORY_INJECTIONS = true;

      try {
        run(function () {
          var igor = env.store.createRecord('user', { name: 'Igor' });
          var post = env.store.createRecord('post', { title: 'Igor\'s unimaginative blog post' });

          igor.set('favouriteMessage', post);

          equal(igor.get('favouriteMessage.title'), 'Igor\'s unimaginative blog post');
        });
      } finally {
        Ember.MODEL_FACTORY_INJECTIONS = injectionValue;
      }
    });

    test('the subclass in a polymorphic belongsTo relationship is an instanceof its superclass', function () {
      expect(1);

      var injectionValue = Ember.MODEL_FACTORY_INJECTIONS;
      Ember.MODEL_FACTORY_INJECTIONS = true;

      try {
        run(function () {
          var message = env.store.createRecord('message', { id: 1 });
          var comment = env.store.createRecord('comment', { id: 2, message: message });
          ok(comment instanceof Message, 'a comment is an instance of a message');
        });
      } finally {
        Ember.MODEL_FACTORY_INJECTIONS = injectionValue;
      }
    });

    test('relationshipsByName does not cache a factory', function () {

      // The model is loaded up via a container. It has relationshipsByName
      // called on it.
      var modelViaFirstFactory = store.modelFor('user');
      get(modelViaFirstFactory, 'relationshipsByName');

      // An app is reset, or the container otherwise destroyed.
      run(env.container, 'destroy');

      // A new model for a relationship is created. Note that this may happen
      // due to an extend call internal to MODEL_FACTORY_INJECTIONS.
      NewMessage = Message.extend();

      // A new store is created.
      env = setupStore({
        user: User,
        message: NewMessage
      });
      store = env.store;

      // relationshipsByName is called again.
      var modelViaSecondFactory = store.modelFor('user');
      var relationshipsByName = get(modelViaSecondFactory, 'relationshipsByName');
      var messageType = relationshipsByName.get('messages').type;

      // A model is looked up in the store based on a string, via user input
      var messageModelFromStore = store.modelFor('message');
      // And the model is lookup up internally via the relationship type
      var messageModelFromRelationType = store.modelFor(messageType);

      equal(messageModelFromRelationType, messageModelFromStore, 'model factory based on relationship type matches the model based on store.modelFor');
    });

    test('relationshipsByName is cached in production', function () {
      var model = store.modelFor('user');
      var oldTesting = Ember.testing;
      //We set the cacheable to true because that is the default state for any CP and then assert that it
      //did not get dynamically changed when accessed
      var relationshipsByName = getComputedPropertyDesc(model, 'relationshipsByName');
      var oldCacheable = relationshipsByName._cacheable;
      relationshipsByName._cacheable = true;
      Ember.testing = false;
      try {
        equal(get(model, 'relationshipsByName'), get(model, 'relationshipsByName'), 'relationshipsByName are cached');
        equal(get(model, 'relationshipsByName'), get(model, 'relationshipsByName'), 'relationshipsByName are cached');
      } finally {
        Ember.testing = oldTesting;
        relationshipsByName._cacheable = oldCacheable;
      }
    });

    test('relatedTypes is cached in production', function () {
      var model = store.modelFor('user');
      var oldTesting = Ember.testing;
      //We set the cacheable to true because that is the default state for any CP and then assert that it
      //did not get dynamically changed when accessed
      var relatedTypes = getComputedPropertyDesc(model, 'relatedTypes');
      var oldCacheable = relatedTypes._cacheable;
      relatedTypes._cacheable = true;
      Ember.testing = false;
      try {
        equal(get(model, 'relatedTypes'), get(model, 'relatedTypes'), 'relatedTypes are cached');
        equal(get(model, 'relatedTypes'), get(model, 'relatedTypes'), 'relatedTypes are cached');
      } finally {
        Ember.testing = oldTesting;
        relatedTypes._cacheable = oldCacheable;
      }
    });

    test('relationships is cached in production', function () {
      var model = store.modelFor('user');
      var oldTesting = Ember.testing;
      //We set the cacheable to true because that is the default state for any CP and then assert that it
      //did not get dynamically changed when accessed
      var relationships = getComputedPropertyDesc(model, 'relationships');
      var oldCacheable = relationships._cacheable;
      relationships._cacheable = true;
      Ember.testing = false;
      try {
        equal(get(model, 'relationships'), get(model, 'relationships'), 'relationships are cached');
        equal(get(model, 'relationships'), get(model, 'relationships'), 'relationships are cached');
      } finally {
        Ember.testing = oldTesting;
        relationships._cacheable = oldCacheable;
      }
    });

    test('relationship changes shouldn’t cause async fetches', function () {
      expect(2);

      /*  Scenario:
       *  ---------
       *
       *    post HM async comments
       *    comments bt sync post
       *
       *    scenario:
       *     - post hm C [1,2,3]
       *     - post has a partially realized comments array comment#1 has been realized
       *     - comment has not yet realized its post relationship
       *     - comment is destroyed
       */

      env.store.modelFor('post').reopen({
        comments: DS.hasMany('comment', {
          async: true,
          inverse: 'post'
        })
      });

      env.store.modelFor('comment').reopen({
        post: DS.belongsTo('post', { async: false })
      });
      var post, comment;
      run(function () {
        post = env.store.push({
          data: {
            id: '1',
            type: 'post',
            relationships: {
              comments: {
                data: [{
                  id: '1',
                  type: 'comment'
                }, {
                  id: '2',
                  type: 'comment'
                }, {
                  id: '3',
                  type: 'comment'
                }]
              }
            }
          }
        });

        comment = env.store.push({
          data: {
            id: '1',
            type: 'comment',
            relationships: {
              post: {
                data: {
                  id: '1',
                  type: 'post'
                }
              }
            }
          }
        });
      });

      env.adapter.deleteRecord = function (store, type, snapshot) {
        ok(snapshot.record instanceof type);
        equal(snapshot.id, 1, 'should first comment');
        return snapshot.record.toJSON({ includeId: true });
      };

      env.adapter.findMany = function (store, type, ids, snapshots) {
        ok(false, 'should not need to findMay more comments, but attempted to anyways');
      };

      run(comment, 'destroyRecord');
    });

    test('Destroying a record with an unloaded aync belongsTo association does not fetch the record', function () {
      expect(2);
      var post;

      env.store.modelFor('message').reopen({
        user: DS.hasMany('user', {
          async: true
        })
      });

      env.store.modelFor('post').reopen({
        user: DS.belongsTo('user', {
          async: true,
          inverse: 'messages'
        })
      });

      run(function () {
        post = env.store.push({
          data: {
            id: '1',
            type: 'post',
            relationships: {
              user: {
                data: {
                  id: '2',
                  type: 'user'
                }
              }
            }
          }
        });
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        throw new Error('Adapter\'s find method should not be called');
      };

      env.adapter.deleteRecord = function (store, type, snapshot) {
        ok(snapshot.record instanceof type);
        equal(snapshot.id, 1, 'should first post');
        return {
          id: '1',
          title: null,
          created_at: null,
          user: '2'
        };
      };

      run(post, 'destroyRecord');
    });

    test('A sync belongsTo errors out if the record is unlaoded', function () {
      var message;
      run(function () {
        message = env.store.push({
          data: {
            id: '1',
            type: 'message',
            relationships: {
              user: {
                data: {
                  id: '2',
                  type: 'user'
                }
              }
            }
          }
        });
      });

      expectAssertion(function () {
        message.get('user');
      }, /You looked up the 'user' relationship on a 'message' with id 1 but some of the associated records were not loaded. Either make sure they are all loaded together with the parent record, or specify that the relationship is async \(`DS.belongsTo\({ async: true }\)`\)/);
    });

    test('Rollbacking attributes for a deleted record restores implicit relationship - async', function () {
      Book.reopen({
        author: DS.belongsTo('author', { async: true })
      });
      var book, author;
      run(function () {
        book = env.store.push({
          data: {
            id: '1',
            type: 'book',
            attributes: {
              name: 'Stanley\'s Amazing Adventures'
            },
            relationships: {
              author: {
                data: {
                  id: '2',
                  type: 'author'
                }
              }
            }
          }
        });
        author = env.store.push({
          data: {
            id: '2',
            type: 'author',
            attributes: {
              name: 'Stanley'
            }
          }
        });
      });
      run(function () {
        author.deleteRecord();
        author.rollbackAttributes();
        book.get('author').then(function (fetchedAuthor) {
          equal(fetchedAuthor, author, 'Book has an author after rollback attributes');
        });
      });
    });

    test('Rollbacking attributes for a deleted record restores implicit relationship - sync', function () {
      var book, author;
      run(function () {
        book = env.store.push({
          data: {
            id: '1',
            type: 'book',
            attributes: {
              name: 'Stanley\'s Amazing Adventures'
            },
            relationships: {
              author: {
                data: {
                  id: '2',
                  type: 'author'
                }
              }
            }
          }
        });
        author = env.store.push({
          data: {
            id: '2',
            type: 'author',
            attributes: {
              name: 'Stanley'
            }
          }
        });
      });
      run(function () {
        author.deleteRecord();
        author.rollbackAttributes();
      });
      equal(book.get('author'), author, 'Book has an author after rollback attributes');
    });

    test('Passing a model as type to belongsTo should not work', function () {
      expect(1);

      expectAssertion(function () {
        User = DS.Model.extend();

        Contact = DS.Model.extend({
          user: belongsTo(User, { async: false })
        });
      }, /The first argument to DS.belongsTo must be a string/);
    });

    test('belongsTo hasData async loaded', function () {
      expect(1);

      Book.reopen({
        author: belongsTo('author', { async: true })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.resolve({ id: 1, name: 'The Greatest Book', author: 2 });
      };

      run(function () {
        store.findRecord('book', 1).then(function (book) {
          var relationship = book._internalModel._relationships.get('author');
          equal(relationship.hasData, true, 'relationship has data');
        });
      });
    });

    test('belongsTo hasData sync loaded', function () {
      expect(1);

      env.adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.resolve({ id: 1, name: 'The Greatest Book', author: 2 });
      };

      run(function () {
        store.findRecord('book', 1).then(function (book) {
          var relationship = book._internalModel._relationships.get('author');
          equal(relationship.hasData, true, 'relationship has data');
        });
      });
    });

    test('belongsTo hasData async not loaded', function () {
      expect(1);

      Book.reopen({
        author: belongsTo('author', { async: true })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.resolve({ id: 1, name: 'The Greatest Book', links: { author: 'author' } });
      };

      run(function () {
        store.findRecord('book', 1).then(function (book) {
          var relationship = book._internalModel._relationships.get('author');
          equal(relationship.hasData, false, 'relationship does not have data');
        });
      });
    });

    test('belongsTo hasData sync not loaded', function () {
      expect(1);

      env.adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.resolve({ id: 1, name: 'The Greatest Book' });
      };

      run(function () {
        store.findRecord('book', 1).then(function (book) {
          var relationship = book._internalModel._relationships.get('author');
          equal(relationship.hasData, false, 'relationship does not have data');
        });
      });
    });

    test('belongsTo hasData async created', function () {
      expect(1);

      Book.reopen({
        author: belongsTo('author', { async: true })
      });

      run(function () {
        var book = store.createRecord('book', { name: 'The Greatest Book' });
        var relationship = book._internalModel._relationships.get('author');
        equal(relationship.hasData, true, 'relationship has data');
      });
    });

    test('belongsTo hasData sync created', function () {
      expect(1);

      run(function () {
        var book = store.createRecord('book', { name: 'The Greatest Book' });
        var relationship = book._internalModel._relationships.get('author');
        equal(relationship.hasData, true, 'relationship has data');
      });
    });

    test('Model\'s belongsTo relationship should not be created during model creation', function () {
      var user;
      run(function () {
        user = env.store.push({
          data: {
            id: '1',
            type: 'user'
          }
        });

        ok(!user._internalModel._relationships.has('favouriteMessage'), 'Newly created record should not have relationships');
      });
    });

    test('Model\'s belongsTo relationship should be created during model creation if relationship passed in constructor', function () {
      var user, message;
      run(function () {
        message = env.store.createRecord('message');
        user = env.store.createRecord('user', {
          name: 'John Doe',
          favouriteMessage: message
        });
        ok(user._internalModel._relationships.has('favouriteMessage'), 'Newly created record with relationships in params passed in its constructor should have relationships');
      });
    });

    test('Model\'s belongsTo relationship should be created during \'set\' method', function () {
      var user, message;
      run(function () {
        message = env.store.createRecord('message');
        user = env.store.createRecord('user');
        user.set('favouriteMessage', message);
        ok(user._internalModel._relationships.has('favouriteMessage'), 'Newly created record with relationships in params passed in its constructor should have relationships');
      });
    });

    test('Model\'s belongsTo relationship should be created during \'get\' method', function () {
      var user;
      run(function () {
        user = env.store.createRecord('user');
        user.get('favouriteMessage');
        ok(user._internalModel._relationships.has('favouriteMessage'), 'Newly created record with relationships in params passed in its constructor should have relationships');
      });
    });
  }
);


define(
  "ember-data/tests/integration/relationships/has-many-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, User, Contact, Email, Phone, Message, Post, Comment;
    var Book, Chapter, Page;
    var get = Ember.get;
    var resolve = Ember.RSVP.resolve;
    var run = Ember.run;

    var attr = DS.attr;
    var hasMany = DS.hasMany;
    var belongsTo = DS.belongsTo;

    function stringify(string) {
      return function () {
        return string;
      };
    }

    module('integration/relationships/has_many - Has-Many Relationships', {
      setup: function () {
        User = DS.Model.extend({
          name: attr('string'),
          messages: hasMany('message', { polymorphic: true, async: false }),
          contacts: hasMany('user', { inverse: null, async: false })
        });

        Contact = DS.Model.extend({
          user: belongsTo('user', { async: false })
        });

        Email = Contact.extend({
          email: attr('string')
        });

        Phone = Contact.extend({
          number: attr('string')
        });

        Message = DS.Model.extend({
          user: belongsTo('user', { async: false }),
          created_at: attr('date')
        });
        Message.toString = stringify('Message');

        Post = Message.extend({
          title: attr('string'),
          comments: hasMany('comment', { async: false })
        });
        Post.toString = stringify('Post');

        Comment = Message.extend({
          body: DS.attr('string'),
          message: DS.belongsTo('post', { polymorphic: true, async: true })
        });
        Comment.toString = stringify('Comment');

        Book = DS.Model.extend({
          title: attr(),
          chapters: hasMany('chapter', { async: true })
        });
        Book.toString = stringify('Book');

        Chapter = DS.Model.extend({
          title: attr(),
          pages: hasMany('page', { async: false })
        });
        Chapter.toString = stringify('Chapter');

        Page = DS.Model.extend({
          number: attr('number'),
          chapter: belongsTo('chapter', { async: false })
        });
        Page.toString = stringify('Page');

        env = setupStore({
          user: User,
          contact: Contact,
          email: Email,
          phone: Phone,
          post: Post,
          comment: Comment,
          message: Message,
          book: Book,
          chapter: Chapter,
          page: Page
        });

        store = env.store;
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    test('When a hasMany relationship is accessed, the adapter\'s findMany method should not be called if all the records in the relationship are already loaded', function () {
      expect(0);

      env.adapter.findMany = function (store, type, ids, snapshots) {
        ok(false, 'The adapter\'s find method should not be called');
      };

      run(function () {
        env.store.push('post', { id: 1, comments: [1] });
        env.store.push('comment', { id: 1 });
        env.store.findRecord('post', 1).then(function (post) {
          return post.get('comments');
        });
      });
    });

    test('adapter.findMany only gets unique IDs even if duplicate IDs are present in the hasMany relationship', function () {
      expect(2);

      env.adapter.findMany = function (store, type, ids, snapshots) {
        equal(type, Chapter, 'type passed to adapter.findMany is correct');
        deepEqual(ids, ['2', '3'], 'ids passed to adapter.findMany are unique');

        return Ember.RSVP.resolve([{ id: 2, title: 'Chapter One' }, { id: 3, title: 'Chapter Two' }]);
      };

      run(function () {
        env.store.push('book', { id: 1, chapters: [2, 3, 3] });
        env.store.findRecord('book', 1).then(function (book) {
          return book.get('chapters');
        });
      });
    });

    // This tests the case where a serializer materializes a has-many
    // relationship as a internalModel that it can fetch lazily. The most
    // common use case of this is to provide a URL to a collection that
    // is loaded later.
    test('A serializer can materialize a hasMany as an opaque token that can be lazily fetched via the adapter\'s findHasMany hook', function () {
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      // When the store asks the adapter for the record with ID 1,
      // provide some fake data.
      env.adapter.findRecord = function (store, type, id, snapshot) {
        equal(type, Post, 'find type was Post');
        equal(id, '1', 'find id was 1');

        return Ember.RSVP.resolve({ id: 1, links: { comments: '/posts/1/comments' } });
      };

      env.adapter.findMany = function (store, type, ids, snapshots) {
        throw new Error('Adapter\'s findMany should not be called');
      };

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        equal(link, '/posts/1/comments', 'findHasMany link was /posts/1/comments');
        equal(relationship.type, 'comment', 'relationship was passed correctly');

        return Ember.RSVP.resolve([{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]);
      };

      run(function () {
        env.store.findRecord('post', 1).then(async(function (post) {
          return post.get('comments');
        })).then(async(function (comments) {
          equal(comments.get('isLoaded'), true, 'comments are loaded');
          equal(comments.get('length'), 2, 'comments have 2 length');
          equal(comments.objectAt(0).get('body'), 'First', 'comment loaded successfully');
        }));
      });
    });

    test('Accessing a hasMany backed by a link multiple times triggers only one request', function () {
      expect(2);
      var count = 0;
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      Comment.reopen({
        message: DS.belongsTo('post', { async: true })
      });
      var post;

      run(function () {
        post = env.store.push('post', { id: 1, links: { comments: '/posts/1/comments' } });
      });

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        start();
        count++;
        equal(count, 1, 'findHasMany has only been called once');
        stop();
        return new Ember.RSVP.Promise(function (resolve, reject) {
          setTimeout(function () {
            var value = [{ id: 1, body: 'First' }, { id: 2, body: 'Second' }];
            resolve(value);
          }, 100);
        });
      };

      stop();
      var promise1, promise2;
      run(function () {
        promise1 = post.get('comments');
        //Invalidate the post.comments CP
        env.store.push('comment', { id: 1, message: 1 });
        promise2 = post.get('comments');
      });
      Ember.RSVP.all([promise1, promise2]).then(function () {
        start();
      });
      equal(promise1.promise, promise2.promise, 'Same promise is returned both times');
    });

    test('A hasMany backed by a link remains a promise after a record has been added to it', function () {
      expect(1);
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      Comment.reopen({
        message: DS.belongsTo('post', { async: true })
      });

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve([{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]);
      };
      var post;
      run(function () {
        post = env.store.push('post', { id: 1, links: { comments: '/posts/1/comments' } });
      });

      run(function () {
        post.get('comments').then(function () {
          env.store.push('comment', { id: 3, message: 1 });
          post.get('comments').then(function () {
            ok(true, 'Promise was called');
          });
        });
      });
    });

    test('A hasMany updated link should not remove new children', function () {
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      Comment.reopen({
        message: DS.belongsTo('post', { async: true })
      });

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve([]);
      };

      env.adapter.createRecord = function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve({
          links: {
            comments: '/some/link'
          }
        });
      };

      run(function () {
        var post = env.store.createRecord('post', {});
        env.store.createRecord('comment', { message: post });

        post.get('comments').then(function (comments) {
          equal(comments.get('length'), 1);

          return post.save();
        }).then(function () {
          return post.get('comments');
        }).then(function (comments) {
          equal(comments.get('length'), 1);
        });
      });
    });

    test('A hasMany updated link should not remove new children when the parent record has children already', function () {
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      Comment.reopen({
        message: DS.belongsTo('post', { async: true })
      });

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve([{ id: 5, body: 'hello' }]);
      };

      env.adapter.createRecord = function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve({
          links: {
            comments: '/some/link'
          }
        });
      };

      run(function () {
        var post = env.store.createRecord('post', {});
        env.store.createRecord('comment', { message: post });

        post.get('comments').then(function (comments) {
          equal(comments.get('length'), 1);

          return post.save();
        }).then(function () {
          return post.get('comments');
        }).then(function (comments) {
          equal(comments.get('length'), 2);
        });
      });
    });

    test('A hasMany relationship can be reloaded if it was fetched via a link', function () {
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        equal(type, Post, 'find type was Post');
        equal(id, '1', 'find id was 1');

        return Ember.RSVP.resolve({ id: 1, links: { comments: '/posts/1/comments' } });
      };

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        equal(relationship.type, 'comment', 'findHasMany relationship type was Comment');
        equal(relationship.key, 'comments', 'findHasMany relationship key was comments');
        equal(link, '/posts/1/comments', 'findHasMany link was /posts/1/comments');

        return Ember.RSVP.resolve([{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]);
      };

      run(function () {
        run(env.store, 'findRecord', 'post', 1).then(function (post) {
          return post.get('comments');
        }).then(function (comments) {
          equal(comments.get('isLoaded'), true, 'comments are loaded');
          equal(comments.get('length'), 2, 'comments have 2 length');

          env.adapter.findHasMany = function (store, snapshot, link, relationship) {
            equal(relationship.type, 'comment', 'findHasMany relationship type was Comment');
            equal(relationship.key, 'comments', 'findHasMany relationship key was comments');
            equal(link, '/posts/1/comments', 'findHasMany link was /posts/1/comments');

            return Ember.RSVP.resolve([{ id: 1, body: 'First' }, { id: 2, body: 'Second' }, { id: 3, body: 'Thirds' }]);
          };

          return comments.reload();
        }).then(function (newComments) {
          equal(newComments.get('length'), 3, 'reloaded comments have 3 length');
        });
      });
    });

    test('A sync hasMany relationship can be reloaded if it was fetched via ids', function () {
      Post.reopen({
        comments: DS.hasMany('comment', { async: false })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        equal(type, Post, 'find type was Post');
        equal(id, '1', 'find id was 1');

        return Ember.RSVP.resolve({ id: 1, comments: [1, 2] });
      };

      run(function () {
        env.store.pushMany('comment', [{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]);

        env.store.findRecord('post', '1').then(function (post) {
          var comments = post.get('comments');
          equal(comments.get('isLoaded'), true, 'comments are loaded');
          equal(comments.get('length'), 2, 'comments have a length of 2');

          env.adapter.findMany = function (store, type, ids, snapshots) {
            return Ember.RSVP.resolve([{ id: 1, body: 'FirstUpdated' }, { id: 2, body: 'Second' }]);
          };

          return comments.reload();
        }).then(function (newComments) {
          equal(newComments.get('firstObject.body'), 'FirstUpdated', 'Record body was correctly updated');
        });
      });
    });

    test('A hasMany relationship can be reloaded if it was fetched via ids', function () {
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        equal(type, Post, 'find type was Post');
        equal(id, '1', 'find id was 1');

        return Ember.RSVP.resolve({ id: 1, comments: [1, 2] });
      };

      env.adapter.findMany = function (store, type, ids, snapshots) {
        return Ember.RSVP.resolve([{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]);
      };

      run(function () {
        env.store.findRecord('post', 1).then(function (post) {
          return post.get('comments');
        }).then(function (comments) {
          equal(comments.get('isLoaded'), true, 'comments are loaded');
          equal(comments.get('length'), 2, 'comments have 2 length');

          env.adapter.findMany = function (store, type, ids, snapshots) {
            return Ember.RSVP.resolve([{ id: 1, body: 'FirstUpdated' }, { id: 2, body: 'Second' }]);
          };

          return comments.reload();
        }).then(function (newComments) {
          equal(newComments.get('firstObject.body'), 'FirstUpdated', 'Record body was correctly updated');
        });
      });
    });

    test('A hasMany relationship can be directly reloaded if it was fetched via ids', function () {
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        equal(type, Post, 'find type was Post');
        equal(id, '1', 'find id was 1');

        return Ember.RSVP.resolve({ id: 1, comments: [1, 2] });
      };

      env.adapter.findMany = function (store, type, ids, snapshots) {
        return Ember.RSVP.resolve([{ id: 1, body: 'FirstUpdated' }, { id: 2, body: 'Second' }]);
      };

      run(function () {
        env.store.findRecord('post', 1).then(function (post) {
          return post.get('comments').reload().then(function (comments) {
            equal(comments.get('isLoaded'), true, 'comments are loaded');
            equal(comments.get('length'), 2, 'comments have 2 length');
            equal(comments.get('firstObject.body'), 'FirstUpdated', 'Record body was correctly updated');
          });
        });
      });
    });

    test('PromiseArray proxies createRecord to its ManyArray once the hasMany is loaded', function () {
      expect(4);

      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve([{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]);
      };
      var post;

      run(function () {
        post = env.store.push('post', { id: 1, links: { comments: 'someLink' } });
      });

      run(function () {
        post.get('comments').then(function (comments) {
          equal(comments.get('isLoaded'), true, 'comments are loaded');
          equal(comments.get('length'), 2, 'comments have 2 length');

          var newComment = post.get('comments').createRecord({ body: 'Third' });
          equal(newComment.get('body'), 'Third', 'new comment is returned');
          equal(comments.get('length'), 3, 'comments have 3 length, including new record');
        });
      });
    });

    test('PromiseArray proxies evented methods to its ManyArray', function () {
      expect(6);

      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve([{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]);
      };
      var post, comments;

      run(function () {
        post = env.store.push('post', { id: 1, links: { comments: 'someLink' } });
        comments = post.get('comments');
      });

      comments.on('on-event', function () {
        ok(true);
      });

      run(function () {
        comments.trigger('on-event');
      });

      equal(comments.has('on-event'), true);

      comments.on('off-event', function () {
        ok(false);
      });

      comments.off('off-event');

      equal(comments.has('off-event'), false);

      comments.one('one-event', function () {
        ok(true);
      });

      equal(comments.has('one-event'), true);

      run(function () {
        comments.trigger('one-event');
      });

      equal(comments.has('one-event'), false);
    });

    test('An updated `links` value should invalidate a relationship cache', function () {
      expect(8);
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        equal(relationship.type, 'comment', 'relationship was passed correctly');

        if (link === '/first') {
          return Ember.RSVP.resolve([{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]);
        } else if (link === '/second') {
          return Ember.RSVP.resolve([{ id: 3, body: 'Third' }, { id: 4, body: 'Fourth' }, { id: 5, body: 'Fifth' }]);
        }
      };
      var post;

      run(function () {
        post = env.store.push('post', { id: 1, links: { comments: '/first' } });
      });

      run(function () {
        post.get('comments').then(function (comments) {
          equal(comments.get('isLoaded'), true, 'comments are loaded');
          equal(comments.get('length'), 2, 'comments have 2 length');
          equal(comments.objectAt(0).get('body'), 'First', 'comment 1 successfully loaded');
          env.store.push('post', { id: 1, links: { comments: '/second' } });
          post.get('comments').then(function (newComments) {
            equal(comments, newComments, 'hasMany array was kept the same');
            equal(newComments.get('length'), 3, 'comments updated successfully');
            equal(newComments.objectAt(0).get('body'), 'Third', 'third comment loaded successfully');
          });
        });
      });
    });

    test('When a polymorphic hasMany relationship is accessed, the adapter\'s findMany method should not be called if all the records in the relationship are already loaded', function () {
      expect(1);

      env.adapter.findMany = function (store, type, ids, snapshots) {
        ok(false, 'The adapter\'s find method should not be called');
      };

      run(function () {
        env.store.push('user', { id: 1, messages: [{ id: 1, type: 'post' }, { id: 3, type: 'comment' }] });
        env.store.push('post', { id: 1 });
        env.store.push('comment', { id: 3 });
      });

      run(function () {
        env.store.findRecord('user', 1).then(function (user) {
          var messages = user.get('messages');
          equal(messages.get('length'), 2, 'The messages are correctly loaded');
        });
      });
    });

    test('When a polymorphic hasMany relationship is accessed, the store can call multiple adapters\' findMany or find methods if the records are not loaded', function () {
      User.reopen({
        messages: hasMany('message', { polymorphic: true, async: true })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        if (type === Post) {
          return Ember.RSVP.resolve({ id: 1 });
        } else if (type === Comment) {
          return Ember.RSVP.resolve({ id: 3 });
        }
      };

      run(function () {
        env.store.push('user', { id: 1, messages: [{ id: 1, type: 'post' }, { id: 3, type: 'comment' }] });
      });

      run(function () {
        env.store.findRecord('user', 1).then(function (user) {
          return user.get('messages');
        }).then(function (messages) {
          equal(messages.get('length'), 2, 'The messages are correctly loaded');
        });
      });
    });

    test('polymorphic hasMany type-checks check the superclass when MODEL_FACTORY_INJECTIONS is enabled', function () {
      expect(1);

      var injectionValue = Ember.MODEL_FACTORY_INJECTIONS;
      Ember.MODEL_FACTORY_INJECTIONS = true;

      try {
        run(function () {
          var igor = env.store.createRecord('user', { name: 'Igor' });
          var comment = env.store.createRecord('comment', { body: 'Well I thought the title was fine' });

          igor.get('messages').addObject(comment);

          equal(igor.get('messages.firstObject.body'), 'Well I thought the title was fine');
        });
      } finally {
        Ember.MODEL_FACTORY_INJECTIONS = injectionValue;
      }
    });

    test('Type can be inferred from the key of a hasMany relationship', function () {
      expect(1);
      run(function () {
        env.store.push('user', { id: 1, contacts: [1] });
        env.store.push('contact', { id: 1 });
      });
      run(function () {
        env.store.findRecord('user', 1).then(function (user) {
          return user.get('contacts');
        }).then(function (contacts) {
          equal(contacts.get('length'), 1, 'The contacts relationship is correctly set up');
        });
      });
    });

    test('Type can be inferred from the key of an async hasMany relationship', function () {
      User.reopen({
        contacts: DS.hasMany({ async: true })
      });

      expect(1);
      run(function () {
        env.store.push('user', { id: 1, contacts: [1] });
        env.store.push('contact', { id: 1 });
      });
      run(function () {
        env.store.findRecord('user', 1).then(function (user) {
          return user.get('contacts');
        }).then(function (contacts) {
          equal(contacts.get('length'), 1, 'The contacts relationship is correctly set up');
        });
      });
    });

    test('Polymorphic relationships work with a hasMany whose type is inferred', function () {
      User.reopen({
        contacts: DS.hasMany({ polymorphic: true, async: false })
      });

      expect(1);
      run(function () {
        env.store.push('user', { id: 1, contacts: [{ id: 1, type: 'email' }, { id: 2, type: 'phone' }] });
        env.store.push('email', { id: 1 });
        env.store.push('phone', { id: 2 });
      });
      run(function () {
        env.store.findRecord('user', 1).then(function (user) {
          return user.get('contacts');
        }).then(function (contacts) {
          equal(contacts.get('length'), 2, 'The contacts relationship is correctly set up');
        });
      });
    });

    test('Polymorphic relationships with a hasMany is set up correctly on both sides', function () {
      expect(2);

      Contact.reopen({
        posts: DS.hasMany('post', { async: false })
      });

      Post.reopen({
        contact: DS.belongsTo('contact', { polymorphic: true, async: false })
      });
      var email, post;

      run(function () {
        email = env.store.createRecord('email');
        post = env.store.createRecord('post', {
          contact: email
        });
      });

      equal(post.get('contact'), email, 'The polymorphic belongsTo is set up correctly');
      equal(get(email, 'posts.length'), 1, 'The inverse has many is set up correctly on the email side.');
    });

    test('A record can\'t be created from a polymorphic hasMany relationship', function () {
      run(function () {
        env.store.push('user', { id: 1, messages: [] });
      });

      run(function () {
        env.store.findRecord('user', 1).then(function (user) {
          return user.get('messages');
        }).then(function (messages) {
          expectAssertion(function () {
            messages.createRecord();
          }, /You cannot add 'message' records to this polymorphic relationship/);
        });
      });
    });

    test('Only records of the same type can be added to a monomorphic hasMany relationship', function () {
      expect(1);
      run(function () {
        env.store.push('post', { id: 1, comments: [] });
        env.store.push('post', { id: 2 });
      });

      run(function () {
        Ember.RSVP.all([env.store.findRecord('post', 1), env.store.findRecord('post', 2)]).then(function (records) {
          expectAssertion(function () {
            records[0].get('comments').pushObject(records[1]);
          }, /You cannot add a record of type 'post' to the 'post.comments' relationship \(only 'comment' allowed\)/);
        });
      });
    });

    test('Only records of the same base type can be added to a polymorphic hasMany relationship', function () {
      expect(2);
      run(function () {
        env.store.push('user', { id: 1, messages: [] });
        env.store.push('user', { id: 2, messages: [] });
        env.store.push('post', { id: 1, comments: [] });
        env.store.push('comment', { id: 3 });
      });
      var asyncRecords;

      run(function () {
        asyncRecords = Ember.RSVP.hash({
          user: env.store.findRecord('user', 1),
          anotherUser: env.store.findRecord('user', 2),
          post: env.store.findRecord('post', 1),
          comment: env.store.findRecord('comment', 3)
        });

        asyncRecords.then(function (records) {
          records.messages = records.user.get('messages');
          return Ember.RSVP.hash(records);
        }).then(function (records) {
          records.messages.pushObject(records.post);
          records.messages.pushObject(records.comment);
          equal(records.messages.get('length'), 2, 'The messages are correctly added');

          expectAssertion(function () {
            records.messages.pushObject(records.anotherUser);
          }, /You cannot add a record of type 'user' to the 'user.messages' relationship \(only 'message' allowed\)/);
        });
      });
    });

    test('A record can be removed from a polymorphic association', function () {
      expect(4);

      run(function () {
        env.store.push('user', { id: 1, messages: [{ id: 3, type: 'comment' }] });
        env.store.push('comment', { id: 3 });
      });
      var asyncRecords;

      run(function () {
        asyncRecords = Ember.RSVP.hash({
          user: env.store.findRecord('user', 1),
          comment: env.store.findRecord('comment', 3)
        });

        asyncRecords.then(function (records) {
          records.messages = records.user.get('messages');
          return Ember.RSVP.hash(records);
        }).then(function (records) {
          equal(records.messages.get('length'), 1, 'The user has 1 message');

          var removedObject = records.messages.popObject();

          equal(removedObject, records.comment, 'The message is correctly removed');
          equal(records.messages.get('length'), 0, 'The user does not have any messages');
          equal(records.messages.objectAt(0), null, 'No messages can\'t be fetched');
        });
      });
    });

    test('When a record is created on the client, its hasMany arrays should be in a loaded state', function () {
      expect(3);

      var post;

      run(function () {
        post = env.store.createRecord('post');
      });

      ok(get(post, 'isLoaded'), 'The post should have isLoaded flag');
      var comments;
      run(function () {
        comments = get(post, 'comments');
      });

      equal(get(comments, 'length'), 0, 'The comments should be an empty array');

      ok(get(comments, 'isLoaded'), 'The comments should have isLoaded flag');
    });

    test('When a record is created on the client, its async hasMany arrays should be in a loaded state', function () {
      expect(4);

      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      var post = run(function () {
        return env.store.createRecord('post');
      });

      ok(get(post, 'isLoaded'), 'The post should have isLoaded flag');

      run(function () {
        get(post, 'comments').then(function (comments) {
          ok(true, 'Comments array successfully resolves');
          equal(get(comments, 'length'), 0, 'The comments should be an empty array');
          ok(get(comments, 'isLoaded'), 'The comments should have isLoaded flag');
        });
      });
    });

    test('we can set records SYNC HM relationship', function () {
      expect(1);
      var post = run(function () {
        return env.store.createRecord('post');
      });
      run(function () {
        post.set('comments', env.store.pushMany('comment', [{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]));
      });
      equal(get(post, 'comments.length'), 2, 'we can set HM relationship');
    });

    test('We can set records ASYNC HM relationship', function () {
      expect(1);
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      var post = run(function () {
        return env.store.createRecord('post');
      });
      run(function () {
        post.set('comments', env.store.pushMany('comment', [{ id: 1, body: 'First' }, { id: 2, body: 'Second' }]));
      });

      post.get('comments').then(async(function (comments) {
        equal(comments.get('length'), 2, 'we can set async HM relationship');
      }));
    });

    test('When a record is saved, its unsaved hasMany records should be kept', function () {
      expect(1);

      var post, comment;

      env.adapter.createRecord = function (store, type, snapshot) {
        return Ember.RSVP.resolve({ id: 1 });
      };

      run(function () {
        post = env.store.createRecord('post');
        comment = env.store.createRecord('comment');
        post.get('comments').pushObject(comment);
        post.save();
      });

      equal(get(post, 'comments.length'), 1, 'The unsaved comment should be in the post\'s comments array');
    });

    test('dual non-async HM <-> BT', function () {
      Post.reopen({
        comments: DS.hasMany('comment', { inverse: 'post', async: false })
      });

      Comment.reopen({
        post: DS.belongsTo('post', { async: false })
      });

      env.adapter.createRecord = function (store, type, snapshot) {
        var data = snapshot.record.serialize();
        data.id = 2;
        return Ember.RSVP.resolve(data);
      };
      var post, firstComment;

      run(function () {
        post = env.store.push('post', { id: 1, comments: [1] });
        firstComment = env.store.push('comment', { id: 1, post: 1 });

        env.store.createRecord('comment', {
          post: post
        }).save().then(function (comment) {
          var commentPost = comment.get('post');
          var postComments = comment.get('post.comments');
          var postCommentsLength = comment.get('post.comments.length');

          deepEqual(post, commentPost, 'expect the new comments post, to be the correct post');
          ok(postComments, 'comments should exist');
          equal(postCommentsLength, 2, 'comment\'s post should have a internalModel back to comment');
          ok(postComments && postComments.indexOf(firstComment) !== -1, 'expect to contain first comment');
          ok(postComments && postComments.indexOf(comment) !== -1, 'expected to contain the new comment');
        });
      });
    });

    test('When an unloaded record is added to the hasMany, it gets fetched once the hasMany is accessed even if the hasMany has been already fetched', function () {
      Post.reopen({
        comments: DS.hasMany('comment', { async: true })
      });

      env.adapter.findMany = function (store, type, ids, snapshots) {
        return resolve([{ id: 1, body: 'first' }, { id: 2, body: 'second' }]);
      };

      env.adapter.findRecord = function (store, type, id, snapshot) {
        return resolve({ id: 3, body: 'third' });
      };
      var post;

      run(function () {
        post = env.store.push('post', { id: 1, comments: [1, 2] });
      });

      run(function () {
        post.get('comments').then(async(function (fetchedComments) {
          equal(fetchedComments.get('length'), 2, 'comments fetched successfully');
          equal(fetchedComments.objectAt(0).get('body'), 'first', 'first comment loaded successfully');
          env.store.push('post', { id: 1, comments: [1, 2, 3] });
          post.get('comments').then(async(function (newlyFetchedComments) {
            equal(newlyFetchedComments.get('length'), 3, 'all three comments fetched successfully');
            equal(newlyFetchedComments.objectAt(2).get('body'), 'third', 'third comment loaded successfully');
          }));
        }));
      });
    });

    test('A sync hasMany errors out if there are unlaoded records in it', function () {
      var post;
      run(function () {
        post = env.store.push('post', { id: 1, comments: [1, 2] });
      });

      expectAssertion(function () {
        run(post, 'get', 'comments');
      }, /You looked up the 'comments' relationship on a 'post' with id 1 but some of the associated records were not loaded. Either make sure they are all loaded together with the parent record, or specify that the relationship is async \(`DS.hasMany\({ async: true }\)`\)/);
    });

    test('If reordered hasMany data has been pushed to the store, the many array reflects the ordering change - sync', function () {
      var comment1, comment2, comment3, comment4;
      var post;
      run(function () {
        comment1 = env.store.push('comment', { id: 1 });
        comment2 = env.store.push('comment', { id: 2 });
        comment3 = env.store.push('comment', { id: 3 });
        comment4 = env.store.push('comment', { id: 4 });
      });

      run(function () {
        post = env.store.push('post', { id: 1, comments: [1, 2] });
      });
      deepEqual(post.get('comments').toArray(), [comment1, comment2], 'Initial ordering is correct');

      run(function () {
        env.store.push('post', { id: 1, comments: [2, 1] });
      });
      deepEqual(post.get('comments').toArray(), [comment2, comment1], 'Updated ordering is correct');

      run(function () {
        env.store.push('post', { id: 1, comments: [2] });
      });
      deepEqual(post.get('comments').toArray(), [comment2], 'Updated ordering is correct');

      run(function () {
        env.store.push('post', { id: 1, comments: [1, 2, 3, 4] });
      });
      deepEqual(post.get('comments').toArray(), [comment1, comment2, comment3, comment4], 'Updated ordering is correct');

      run(function () {
        env.store.push('post', { id: 1, comments: [4, 3] });
      });
      deepEqual(post.get('comments').toArray(), [comment4, comment3], 'Updated ordering is correct');

      run(function () {
        env.store.push('post', { id: 1, comments: [4, 2, 3, 1] });
      });
      deepEqual(post.get('comments').toArray(), [comment4, comment2, comment3, comment1], 'Updated ordering is correct');
    });

    test('Rollbacking attributes for deleted record restores implicit relationship correctly when the hasMany side has been deleted - async', function () {
      var book, chapter;
      run(function () {
        book = env.store.push('book', { id: 1, title: 'Stanley\'s Amazing Adventures', chapters: [2] });
        chapter = env.store.push('chapter', { id: 2, title: 'Sailing the Seven Seas' });
      });
      run(function () {
        chapter.deleteRecord();
        chapter.rollbackAttributes();
      });
      run(function () {
        book.get('chapters').then(function (fetchedChapters) {
          equal(fetchedChapters.objectAt(0), chapter, 'Book has a chapter after rollback attributes');
        });
      });
    });

    test('Rollbacking attributes for deleted record restores implicit relationship correctly when the hasMany side has been deleted - sync', function () {
      var book, chapter;
      run(function () {
        book = env.store.push('book', { id: 1, title: 'Stanley\'s Amazing Adventures', chapters: [2] });
        chapter = env.store.push('chapter', { id: 2, title: 'Sailing the Seven Seas' });
      });
      run(function () {
        chapter.deleteRecord();
        chapter.rollbackAttributes();
      });
      run(function () {
        equal(book.get('chapters.firstObject'), chapter, 'Book has a chapter after rollback attributes');
      });
    });

    test('Rollbacking attributes for deleted record restores implicit relationship correctly when the belongsTo side has been deleted - async', function () {
      Page.reopen({
        chapter: DS.belongsTo('chapter', { async: true })
      });
      var chapter, page;
      run(function () {
        chapter = env.store.push('chapter', { id: 2, title: 'Sailing the Seven Seas' });
        page = env.store.push('page', { id: 3, number: 1, chapter: 2 });
      });
      run(function () {
        chapter.deleteRecord();
        chapter.rollbackAttributes();
      });
      run(function () {
        page.get('chapter').then(function (fetchedChapter) {
          equal(fetchedChapter, chapter, 'Page has a chapter after rollback attributes');
        });
      });
    });

    test('Rollbacking attributes for deleted record restores implicit relationship correctly when the belongsTo side has been deleted - sync', function () {
      var chapter, page;
      run(function () {
        chapter = env.store.push('chapter', { id: 2, title: 'Sailing the Seven Seas' });
        page = env.store.push('page', { id: 3, number: 1, chapter: 2 });
      });
      run(function () {
        chapter.deleteRecord();
        chapter.rollbackAttributes();
      });
      run(function () {
        equal(page.get('chapter'), chapter, 'Page has a chapter after rollback attributes');
      });
    });

    test('ManyArray notifies the array observers and flushes bindings when removing', function () {
      expect(2);
      var chapter, page, page2;
      var observe = false;

      run(function () {
        page = env.store.push('page', { id: 1, number: 1 });
        page2 = env.store.push('page', { id: 2, number: 2 });
        chapter = env.store.push('chapter', { id: 1, title: 'Sailing the Seven Seas', pages: [1, 2] });
        chapter.get('pages').addEnumerableObserver(this, {
          willChange: function (pages, removing, addCount) {
            if (observe) {
              equal(removing[0], page2, 'page2 is passed to willChange');
            }
          },
          didChange: function (pages, removeCount, adding) {
            if (observe) {
              equal(removeCount, 1, 'removeCount is correct');
            }
          }
        });
      });
      run(function () {
        observe = true;
        page2.set('chapter', null);
        observe = false;
      });
    });

    test('ManyArray notifies the array observers and flushes bindings when adding', function () {
      expect(2);
      var chapter, page, page2;
      var observe = false;

      run(function () {
        page = env.store.push('page', { id: 1, number: 1 });
        page2 = env.store.push('page', { id: 2, number: 2 });
        chapter = env.store.push('chapter', { id: 1, title: 'Sailing the Seven Seas', pages: [1] });
        chapter.get('pages').addEnumerableObserver(this, {
          willChange: function (pages, removing, addCount) {
            if (observe) {
              equal(addCount, 1, 'addCount is correct');
            }
          },
          didChange: function (pages, removeCount, adding) {
            if (observe) {
              equal(adding[0], page2, 'page2 is passed to didChange');
            }
          }
        });
      });
      run(function () {
        observe = true;
        page2.set('chapter', chapter);
        observe = false;
      });
    });

    test('Passing a model as type to hasMany should not work', function () {
      expect(1);

      expectAssertion(function () {
        User = DS.Model.extend();

        Contact = DS.Model.extend({
          users: hasMany(User, { async: false })
        });
      }, /The first argument to DS.hasMany must be a string/);
    });

    test('Relationship.clear removes all records correctly', function () {
      var post;

      Comment.reopen({
        post: DS.belongsTo('post', { async: false })
      });

      Post.reopen({
        comments: DS.hasMany('comment', { inverse: 'post', async: false })
      });

      run(function () {
        post = env.store.push('post', { id: 2, title: 'Sailing the Seven Seas', comments: [1, 2] });
        env.store.pushMany('comment', [{ id: 1, post: 2 }, { id: 2, post: 2 }, { id: 3, post: 2 }]);
      });

      run(function () {
        post._internalModel._relationships.get('comments').clear();
        var comments = Ember.A(env.store.peekAll('comment'));
        deepEqual(comments.mapBy('post'), [null, null, null]);
      });
    });

    test('unloading a record with associated records does not prevent the store from tearing down', function () {
      var post;

      Comment.reopen({
        post: DS.belongsTo('post', { async: false })
      });

      Post.reopen({
        comments: DS.hasMany('comment', { inverse: 'post', async: false })
      });

      run(function () {
        post = env.store.push('post', { id: 2, title: 'Sailing the Seven Seas', comments: [1, 2] });
        env.store.pushMany('comment', [{ id: 1, post: 2 }, { id: 2, post: 2 }]);

        // This line triggers the original bug that gets manifested
        // in teardown for apps, e.g. store.destroy that is caused by
        // App.destroy().
        // Relationship#clear uses Ember.Set#forEach, which does incorrect
        // iteration when the set is being mutated (in our case, the index gets off
        // because records are being removed)
        env.store.unloadRecord(post);
      });
      try {
        run(function () {
          env.store.destroy();
        });
        ok(true, 'store destroyed correctly');
      } catch (error) {
        ok(false, 'store prevented from being destroyed');
      }
    });

    test('adding and removing records from hasMany relationship #2666', function () {
      expect(4);

      var Post = DS.Model.extend({
        comments: DS.hasMany('comment', { async: true })
      });
      var POST_FIXTURES = [{ id: 1, comments: [1, 2, 3] }];

      var Comment = DS.Model.extend({
        post: DS.belongsTo('post', { async: false })
      });

      var COMMENT_FIXTURES = [{ id: 1 }, { id: 2 }, { id: 3 }];

      env = setupStore({
        post: Post,
        comment: Comment,
        adapter: DS.RESTAdapter
      });

      env.registry.register('adapter:comment', DS.RESTAdapter.extend({
        deleteRecord: function (record) {
          return Ember.RSVP.resolve();
        },
        updateRecord: function (record) {
          return Ember.RSVP.resolve();
        },
        createRecord: function () {
          return Ember.RSVP.resolve();
        }
      }));

      run(function () {
        env.store.pushMany('post', POST_FIXTURES);
        env.store.pushMany('comment', COMMENT_FIXTURES);
      });

      run(function () {
        stop();
        env.store.findRecord('post', 1).then(function (post) {
          var comments = post.get('comments');
          equal(comments.get('length'), 3, 'Initial comments count');

          // Add comment #4
          var comment = env.store.createRecord('comment');
          comments.addObject(comment);
          return comment.save().then(function () {
            var comments = post.get('comments');
            equal(comments.get('length'), 4, 'Comments count after first add');

            // Delete comment #4
            return comments.get('lastObject').destroyRecord();
          }).then(function () {
            var comments = post.get('comments');
            equal(comments.get('length'), 3, 'Comments count after delete');

            // Add another comment #4
            var comment = env.store.createRecord('comment');
            comments.addObject(comment);
            return comment.save();
          }).then(function () {
            var comments = post.get('comments');
            equal(comments.get('length'), 4, 'Comments count after second add');
            start();
          });
        });
      });
    });

    test('hasMany hasData async loaded', function () {
      expect(1);

      Chapter.reopen({
        pages: hasMany('pages', { async: true })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.resolve({ id: 1, title: 'The Story Begins', pages: [2, 3] });
      };

      run(function () {
        store.findRecord('chapter', 1).then(function (chapter) {
          var relationship = chapter._internalModel._relationships.get('pages');
          equal(relationship.hasData, true, 'relationship has data');
        });
      });
    });

    test('hasMany hasData sync loaded', function () {
      expect(1);

      env.adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.resolve({ id: 1, title: 'The Story Begins', pages: [2, 3] });
      };

      run(function () {
        store.findRecord('chapter', 1).then(function (chapter) {
          var relationship = chapter._internalModel._relationships.get('pages');
          equal(relationship.hasData, true, 'relationship has data');
        });
      });
    });

    test('hasMany hasData async not loaded', function () {
      expect(1);

      Chapter.reopen({
        pages: hasMany('pages', { async: true })
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.resolve({ id: 1, title: 'The Story Begins', links: { pages: 'pages' } });
      };

      run(function () {
        store.findRecord('chapter', 1).then(function (chapter) {
          var relationship = chapter._internalModel._relationships.get('pages');
          equal(relationship.hasData, false, 'relationship does not have data');
        });
      });
    });

    test('hasMany hasData sync not loaded', function () {
      expect(1);

      env.adapter.findRecord = function (store, type, id, snapshot) {
        return Ember.RSVP.resolve({ id: 1, title: 'The Story Begins' });
      };

      run(function () {
        store.findRecord('chapter', 1).then(function (chapter) {
          var relationship = chapter._internalModel._relationships.get('pages');
          equal(relationship.hasData, false, 'relationship does not have data');
        });
      });
    });

    test('hasMany hasData async created', function () {
      expect(1);

      Chapter.reopen({
        pages: hasMany('pages', { async: true })
      });

      run(function () {
        var chapter = store.createRecord('chapter', { title: 'The Story Begins' });
        var relationship = chapter._internalModel._relationships.get('pages');
        equal(relationship.hasData, true, 'relationship has data');
      });
    });

    test('hasMany hasData sync created', function () {
      expect(1);

      run(function () {
        var chapter = store.createRecord('chapter', { title: 'The Story Begins' });
        var relationship = chapter._internalModel._relationships.get('pages');
        equal(relationship.hasData, true, 'relationship has data');
      });
    });

    test('Model\'s hasMany relationship should not be created during model creation', function () {
      var user;
      run(function () {
        user = env.store.push('user', { id: 1 });
        ok(!user._internalModel._relationships.has('messages'), 'Newly created record should not have relationships');
      });
    });

    test('Model\'s belongsTo relationship should be created during \'get\' method', function () {
      var user;
      run(function () {
        user = env.store.createRecord('user');
        user.get('messages');
        ok(user._internalModel._relationships.has('messages'), 'Newly created record with relationships in params passed in its constructor should have relationships');
      });
    });

    test('metadata is accessible when pushed as a meta property for a relationship', function () {
      expect(1);
      var book;
      env.adapter.findHasMany = function () {
        return resolve({});
      };

      run(function () {
        book = env.store.push('book', { id: 1, title: 'Sailing the Seven Seas', meta: { chapters: 'the lefkada sea' }, links: { chapters: '/chapters' } });
      });

      run(function () {
        equal(book._internalModel._relationships.get('chapters').meta, 'the lefkada sea', 'meta is there');
      });
    });

    test('metadata is accessible when return from a fetchLink', function () {
      expect(1);
      env.registry.register('serializer:application', DS.RESTSerializer);

      env.adapter.findHasMany = function () {
        return resolve({
          meta: {
            foo: 'bar'
          },
          chapters: [{ id: '2' }, { id: '3' }]
        });
      };

      var book;

      run(function () {
        book = env.store.push('book', { id: 1, title: 'Sailing the Seven Seas', links: { chapters: '/chapters' } });
      });

      run(function () {
        book.get('chapters').then(function (chapters) {
          var meta = chapters.get('meta');
          equal(get(meta, 'foo'), 'bar', 'metadata is available');
        });
      });
    });

    test('metadata should be reset between requests', function () {
      var counter = 0;
      env.registry.register('serializer:application', DS.RESTSerializer);

      env.adapter.findHasMany = function () {
        var data = {
          meta: {
            foo: 'bar'
          },
          chapters: [{ id: '2' }, { id: '3' }]
        };

        ok(true, 'findHasMany should be called twice');

        if (counter === 1) {
          delete data.meta;
        }

        counter++;

        return resolve(data);
      };

      var book1, book2;

      run(function () {
        book1 = env.store.push('book', { id: 1, title: 'Sailing the Seven Seas', links: { chapters: 'chapters' } });
        book2 = env.store.push('book', { id: 2, title: 'Another book title', links: { chapters: 'chapters' } });
      });

      run(function () {
        book1.get('chapters').then(function (chapters) {
          var meta = chapters.get('meta');
          equal(get(meta, 'foo'), 'bar', 'metadata should available');

          book2.get('chapters').then(function (chapters) {
            var meta = chapters.get('meta');
            equal(meta, undefined, 'metadata should not be available');
          });
        });
      });
    });
  }
);


define(
  "ember-data/tests/integration/relationships/inverse-relationships-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Post, Comment, Message, User;
    var run = Ember.run;

    module('integration/relationships/inverse_relationships - Inverse Relationships');

    test('When a record is added to a has-many relationship, the inverse belongsTo is determined automatically', function () {
      Post = DS.Model.extend({
        comments: DS.hasMany('comment', { async: false })
      });

      Comment = DS.Model.extend({
        post: DS.belongsTo('post', { async: false })
      });

      var env = setupStore({ post: Post, comment: Comment });
      var store = env.store;
      var comment, post;

      run(function () {
        comment = store.createRecord('comment');
        post = store.createRecord('post');
      });

      equal(comment.get('post'), null, 'no post has been set on the comment');

      run(function () {
        post.get('comments').pushObject(comment);
      });
      equal(comment.get('post'), post, 'post was set on the comment');
    });

    test('Inverse relationships can be explicitly nullable', function () {
      User = DS.Model.extend();

      Post = DS.Model.extend({
        lastParticipant: DS.belongsTo('user', { inverse: null, async: false }),
        participants: DS.hasMany('user', { inverse: 'posts', async: false })
      });

      User.reopen({
        posts: DS.hasMany('post', { inverse: 'participants', async: false })
      });

      var store = createStore({
        user: User,
        post: Post
      });
      var user, post;

      run(function () {
        user = store.createRecord('user');
        post = store.createRecord('post');
      });

      equal(user.inverseFor('posts').name, 'participants', 'User.posts inverse is Post.participants');
      equal(post.inverseFor('lastParticipant'), null, 'Post.lastParticipant has no inverse');
      equal(post.inverseFor('participants').name, 'posts', 'Post.participants inverse is User.posts');
    });

    test('When a record is added to a has-many relationship, the inverse belongsTo can be set explicitly', function () {
      Post = DS.Model.extend({
        comments: DS.hasMany('comment', { inverse: 'redPost', async: false })
      });

      Comment = DS.Model.extend({
        onePost: DS.belongsTo('post', { async: false }),
        twoPost: DS.belongsTo('post', { async: false }),
        redPost: DS.belongsTo('post', { async: false }),
        bluePost: DS.belongsTo('post', { async: false })
      });

      var env = setupStore({ post: Post, comment: Comment });
      var store = env.store;
      var comment, post;

      run(function () {
        comment = store.createRecord('comment');
        post = store.createRecord('post');
      });

      equal(comment.get('onePost'), null, 'onePost has not been set on the comment');
      equal(comment.get('twoPost'), null, 'twoPost has not been set on the comment');
      equal(comment.get('redPost'), null, 'redPost has not been set on the comment');
      equal(comment.get('bluePost'), null, 'bluePost has not been set on the comment');

      run(function () {
        post.get('comments').pushObject(comment);
      });

      equal(comment.get('onePost'), null, 'onePost has not been set on the comment');
      equal(comment.get('twoPost'), null, 'twoPost has not been set on the comment');
      equal(comment.get('redPost'), post, 'redPost has been set on the comment');
      equal(comment.get('bluePost'), null, 'bluePost has not been set on the comment');
    });

    test('When a record\'s belongsTo relationship is set, it can specify the inverse hasMany to which the new child should be added', function () {
      Post = DS.Model.extend({
        meComments: DS.hasMany('comment', { async: false }),
        youComments: DS.hasMany('comment', { async: false }),
        everyoneWeKnowComments: DS.hasMany('comment', { async: false })
      });

      Comment = DS.Model.extend({
        post: DS.belongsTo('post', { inverse: 'youComments', async: false })
      });

      var env = setupStore({ post: Post, comment: Comment });
      var store = env.store;
      var comment, post;

      run(function () {
        comment = store.createRecord('comment');
        post = store.createRecord('post');
      });

      equal(post.get('meComments.length'), 0, 'meComments has no posts');
      equal(post.get('youComments.length'), 0, 'youComments has no posts');
      equal(post.get('everyoneWeKnowComments.length'), 0, 'everyoneWeKnowComments has no posts');

      run(function () {
        comment.set('post', post);
      });

      equal(comment.get('post'), post, 'The post that was set can be retrieved');

      equal(post.get('meComments.length'), 0, 'meComments has no posts');
      equal(post.get('youComments.length'), 1, 'youComments had the post added');
      equal(post.get('everyoneWeKnowComments.length'), 0, 'everyoneWeKnowComments has no posts');
    });

    test('When setting a belongsTo, the OneToOne invariant is respected even when other records have been previously used', function () {
      Post = DS.Model.extend({
        bestComment: DS.belongsTo('comment', { async: false })
      });

      Comment = DS.Model.extend({
        post: DS.belongsTo('post', { async: false })
      });

      var env = setupStore({ post: Post, comment: Comment });
      var store = env.store;
      var comment, post, post2;

      run(function () {
        comment = store.createRecord('comment');
        post = store.createRecord('post');
        post2 = store.createRecord('post');
      });
      run(function () {
        comment.set('post', post);
        post2.set('bestComment', null);
      });

      equal(comment.get('post'), post);
      equal(post.get('bestComment'), comment);
      equal(post2.get('bestComment'), null);

      run(function () {
        comment.set('post', post2);
      });

      equal(comment.get('post'), post2);
      equal(post.get('bestComment'), null);
      equal(post2.get('bestComment'), comment);
    });

    test('When setting a belongsTo, the OneToOne invariant is transitive', function () {
      Post = DS.Model.extend({
        bestComment: DS.belongsTo('comment', { async: false })
      });

      Comment = DS.Model.extend({
        post: DS.belongsTo('post', { async: false })
      });

      var store = createStore({
        post: Post,
        comment: Comment
      });
      var post, post2, comment;

      run(function () {
        comment = store.createRecord('comment');
        post = store.createRecord('post');
        post2 = store.createRecord('post');
      });

      run(function () {
        comment.set('post', post);
      });

      equal(comment.get('post'), post);
      equal(post.get('bestComment'), comment);
      equal(post2.get('bestComment'), null);

      run(function () {
        post2.set('bestComment', comment);
      });

      equal(comment.get('post'), post2);
      equal(post.get('bestComment'), null);
      equal(post2.get('bestComment'), comment);
    });

    test('When setting a belongsTo, the OneToOne invariant is commutative', function () {
      Post = DS.Model.extend({
        bestComment: DS.belongsTo('comment', { async: false })
      });

      Comment = DS.Model.extend({
        post: DS.belongsTo('post', { async: false })
      });

      var store = createStore({
        post: Post,
        comment: Comment
      });
      var post, comment, comment2;

      run(function () {
        post = store.createRecord('post');
        comment = store.createRecord('comment');
        comment2 = store.createRecord('comment');

        comment.set('post', post);
      });

      equal(comment.get('post'), post);
      equal(post.get('bestComment'), comment);
      equal(comment2.get('post'), null);

      run(function () {
        post.set('bestComment', comment2);
      });

      equal(comment.get('post'), null);
      equal(post.get('bestComment'), comment2);
      equal(comment2.get('post'), post);
    });

    test('OneToNone relationship works', function () {
      expect(3);
      Post = DS.Model.extend({
        name: DS.attr('string')
      });

      Comment = DS.Model.extend({
        post: DS.belongsTo('post', { async: false })
      });

      var env = setupStore({ post: Post, comment: Comment });
      var store = env.store;
      var comment, post1, post2;

      run(function () {
        comment = store.createRecord('comment');
        post1 = store.createRecord('post');
        post2 = store.createRecord('post');
      });

      run(function () {
        comment.set('post', post1);
      });
      equal(comment.get('post'), post1, 'the post is set to the first one');

      run(function () {
        comment.set('post', post2);
      });
      equal(comment.get('post'), post2, 'the post is set to the second one');

      run(function () {
        comment.set('post', post1);
      });
      equal(comment.get('post'), post1, 'the post is re-set to the first one');
    });

    test('When a record is added to or removed from a polymorphic has-many relationship, the inverse belongsTo can be set explicitly', function () {
      User = DS.Model.extend({
        messages: DS.hasMany('message', {
          async: false,
          inverse: 'redUser',
          polymorphic: true
        })
      });

      Message = DS.Model.extend({
        oneUser: DS.belongsTo('user', { async: false }),
        twoUser: DS.belongsTo('user', { async: false }),
        redUser: DS.belongsTo('user', { async: false }),
        blueUser: DS.belongsTo('user', { async: false })
      });

      Post = Message.extend();

      var env = setupStore({ user: User, message: Message, post: Post });
      var store = env.store;
      var post, user;

      run(function () {
        post = store.createRecord('post');
        user = store.createRecord('user');
      });

      equal(post.get('oneUser'), null, 'oneUser has not been set on the user');
      equal(post.get('twoUser'), null, 'twoUser has not been set on the user');
      equal(post.get('redUser'), null, 'redUser has not been set on the user');
      equal(post.get('blueUser'), null, 'blueUser has not been set on the user');

      run(function () {
        user.get('messages').pushObject(post);
      });

      equal(post.get('oneUser'), null, 'oneUser has not been set on the user');
      equal(post.get('twoUser'), null, 'twoUser has not been set on the user');
      equal(post.get('redUser'), user, 'redUser has been set on the user');
      equal(post.get('blueUser'), null, 'blueUser has not been set on the user');

      run(function () {
        user.get('messages').popObject();
      });

      equal(post.get('oneUser'), null, 'oneUser has not been set on the user');
      equal(post.get('twoUser'), null, 'twoUser has not been set on the user');
      equal(post.get('redUser'), null, 'redUser has bot been set on the user');
      equal(post.get('blueUser'), null, 'blueUser has not been set on the user');
    });

    test('When a record\'s belongsTo relationship is set, it can specify the inverse polymorphic hasMany to which the new child should be added or removed', function () {
      User = DS.Model.extend({
        meMessages: DS.hasMany('message', { polymorphic: true, async: false }),
        youMessages: DS.hasMany('message', { polymorphic: true, async: false }),
        everyoneWeKnowMessages: DS.hasMany('message', { polymorphic: true, async: false })
      });

      Message = DS.Model.extend({
        user: DS.belongsTo('user', { inverse: 'youMessages', async: false })
      });

      Post = Message.extend();

      var env = setupStore({ user: User, message: Message, post: Post });
      var store = env.store;
      var user, post;

      run(function () {
        user = store.createRecord('user');
        post = store.createRecord('post');
      });

      equal(user.get('meMessages.length'), 0, 'meMessages has no posts');
      equal(user.get('youMessages.length'), 0, 'youMessages has no posts');
      equal(user.get('everyoneWeKnowMessages.length'), 0, 'everyoneWeKnowMessages has no posts');

      run(function () {
        post.set('user', user);
      });

      equal(user.get('meMessages.length'), 0, 'meMessages has no posts');
      equal(user.get('youMessages.length'), 1, 'youMessages had the post added');
      equal(user.get('everyoneWeKnowMessages.length'), 0, 'everyoneWeKnowMessages has no posts');

      run(function () {
        post.set('user', null);
      });

      equal(user.get('meMessages.length'), 0, 'meMessages has no posts');
      equal(user.get('youMessages.length'), 0, 'youMessages has no posts');
      equal(user.get('everyoneWeKnowMessages.length'), 0, 'everyoneWeKnowMessages has no posts');
    });

    test('When a record\'s polymorphic belongsTo relationship is set, it can specify the inverse hasMany to which the new child should be added', function () {
      Message = DS.Model.extend({
        meMessages: DS.hasMany('comment', { inverse: null, async: false }),
        youMessages: DS.hasMany('comment', { inverse: 'message', async: false }),
        everyoneWeKnowMessages: DS.hasMany('comment', { inverse: null, async: false })
      });

      Post = Message.extend();

      Comment = Message.extend({
        message: DS.belongsTo('message', {
          async: false,
          polymorphic: true,
          inverse: 'youMessages'
        })
      });

      var env = setupStore({ comment: Comment, message: Message, post: Post });
      var store = env.store;
      var comment, post;

      run(function () {
        comment = store.createRecord('comment');
        post = store.createRecord('post');
      });

      equal(post.get('meMessages.length'), 0, 'meMessages has no posts');
      equal(post.get('youMessages.length'), 0, 'youMessages has no posts');
      equal(post.get('everyoneWeKnowMessages.length'), 0, 'everyoneWeKnowMessages has no posts');

      run(function () {
        comment.set('message', post);
      });

      equal(post.get('meMessages.length'), 0, 'meMessages has no posts');
      equal(post.get('youMessages.length'), 1, 'youMessages had the post added');
      equal(post.get('everyoneWeKnowMessages.length'), 0, 'everyoneWeKnowMessages has no posts');

      run(function () {
        comment.set('message', null);
      });

      equal(post.get('meMessages.length'), 0, 'meMessages has no posts');
      equal(post.get('youMessages.length'), 0, 'youMessages has no posts');
      equal(post.get('everyoneWeKnowMessages.length'), 0, 'everyoneWeKnowMessages has no posts');
    });

    test('Inverse relationships that don\'t exist throw a nice error for a hasMany', function () {
      User = DS.Model.extend();
      Comment = DS.Model.extend();

      Post = DS.Model.extend({
        comments: DS.hasMany('comment', { inverse: 'testPost', async: false })
      });

      var env = setupStore({ post: Post, comment: Comment, user: User });
      var comment, post;
      run(function () {
        comment = env.store.createRecord('comment');
      });

      expectAssertion(function () {
        run(function () {
          post = env.store.createRecord('post');
          post.get('comments');
        });
      }, /We found no inverse relationships by the name of 'testPost' on the 'comment' model/);
    });

    test('Inverse relationships that don\'t exist throw a nice error for a belongsTo', function () {
      User = DS.Model.extend();
      Comment = DS.Model.extend();

      Post = DS.Model.extend({
        user: DS.belongsTo('user', { inverse: 'testPost', async: false })
      });

      var env = setupStore({ post: Post, comment: Comment, user: User });
      var user, post;
      run(function () {
        user = env.store.createRecord('user');
      });

      expectAssertion(function () {
        run(function () {
          post = env.store.createRecord('post');
          post.get('user');
        });
      }, /We found no inverse relationships by the name of 'testPost' on the 'user' model/);
    });
  }
);


define(
  "ember-data/tests/integration/relationships/many-to-many-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Account, Topic, User, store, env;
    var run = Ember.run;

    var attr = DS.attr;
    var hasMany = DS.hasMany;

    function stringify(string) {
      return function () {
        return string;
      };
    }

    module('integration/relationships/many_to_many_test - ManyToMany relationships', {
      setup: function () {
        User = DS.Model.extend({
          name: attr('string'),
          topics: hasMany('topic', { async: true }),
          accounts: hasMany('account', { async: false })
        });

        User.toString = stringify('User');

        Account = DS.Model.extend({
          state: attr(),
          users: hasMany('user', { async: false })
        });

        Account.toString = stringify('Account');

        Topic = DS.Model.extend({
          title: attr('string'),
          users: hasMany('user', { async: true })
        });

        Topic.toString = stringify('Topic');

        env = setupStore({
          user: User,
          topic: Topic,
          account: Account
        });

        store = env.store;
      },

      teardown: function () {
        run(function () {
          env.container.destroy();
        });
      }
    });

    /*
      Server loading tests
    */

    test('Loading from one hasMany side reflects on the other hasMany side - async', function () {
      run(function () {
        store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              topics: {
                data: [{
                  id: '2',
                  type: 'topic'
                }, {
                  id: '3',
                  type: 'topic'
                }]
              }
            }
          }
        });
      });

      var topic = run(function () {
        return store.push({
          data: {
            id: '2',
            type: 'topic',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });

      run(function () {
        topic.get('users').then(async(function (fetchedUsers) {
          equal(fetchedUsers.get('length'), 1, 'User relationship was set up correctly');
        }));
      });
    });

    test('Relationship is available from the belongsTo side even if only loaded from the hasMany side - sync', function () {
      var account;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
      });

      run(function () {
        equal(account.get('users.length'), 1, 'User relationship was set up correctly');
      });
    });

    test('Fetching a hasMany where a record was removed reflects on the other hasMany side - async', function () {
      var user, topic;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              topics: {
                data: [{
                  id: '2',
                  type: 'topic'
                }]
              }
            }
          }
        });
        topic = store.push({
          data: {
            id: '2',
            type: 'topic',
            attributes: {
              title: 'EmberFest was great'
            },
            relationships: {
              users: {
                data: []
              }
            }
          }
        });
      });
      run(function () {
        user.get('topics').then(async(function (fetchedTopics) {
          equal(fetchedTopics.get('length'), 0, 'Topics were removed correctly');
          equal(fetchedTopics.objectAt(0), null, 'Topics can\'t be fetched');
          topic.get('users').then(async(function (fetchedUsers) {
            equal(fetchedUsers.get('length'), 0, 'Users were removed correctly');
            equal(fetchedUsers.objectAt(0), null, 'User can\'t be fetched');
          }));
        }));
      });
    });

    test('Fetching a hasMany where a record was removed reflects on the other hasMany side - async', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            },
            relationships: {
              users: {
                data: []
              }
            }
          }
        });
      });

      equal(user.get('accounts.length'), 0, 'Accounts were removed correctly');
      equal(account.get('users.length'), 0, 'Users were removed correctly');
    });

    /*
      Local edits
    */

    test('Pushing to a hasMany reflects on the other hasMany side - async', function () {
      expect(1);
      var user, topic;

      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              topics: {
                data: []
              }
            }
          }
        });
        topic = store.push({
          data: {
            id: '2',
            type: 'topic',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });

      run(function () {
        topic.get('users').then(async(function (fetchedUsers) {
          fetchedUsers.pushObject(user);
          user.get('topics').then(async(function (fetchedTopics) {
            equal(fetchedTopics.get('length'), 1, 'User relationship was set up correctly');
          }));
        }));
      });
    });

    test('Pushing to a hasMany reflects on the other hasMany side - sync', function () {
      var account, stanley;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        stanley = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
        stanley.get('accounts').pushObject(account);
      });

      equal(account.get('users.length'), 1, 'User relationship was set up correctly');
    });

    test('Removing a record from a hasMany reflects on the other hasMany side - async', function () {
      var user, topic;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              topics: {
                data: [{
                  id: '2',
                  type: 'topic'
                }]
              }
            }
          }
        });
        topic = store.push({
          data: {
            id: '2',
            type: 'topic',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });

      run(function () {
        user.get('topics').then(async(function (fetchedTopics) {
          equal(fetchedTopics.get('length'), 1, 'Topics were setup correctly');
          fetchedTopics.removeObject(topic);
          topic.get('users').then(async(function (fetchedUsers) {
            equal(fetchedUsers.get('length'), 0, 'Users were removed correctly');
            equal(fetchedUsers.objectAt(0), null, 'User can\'t be fetched');
          }));
        }));
      });
    });

    test('Removing a record from a hasMany reflects on the other hasMany side - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
      });

      equal(account.get('users.length'), 1, 'Users were setup correctly');
      run(function () {
        account.get('users').removeObject(user);
      });
      equal(user.get('accounts.length'), 0, 'Accounts were removed correctly');
      equal(account.get('users.length'), 0, 'Users were removed correctly');
    });

    /*
    Deleting tests
    */

    test('Deleting a record that has a hasMany relationship removes it from the otherMany array but does not remove the other record from itself - async', function () {
      var user, topic;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              topics: {
                data: [{
                  id: '2',
                  type: 'topic'
                }]
              }
            }
          }
        });
        topic = store.push({
          data: {
            id: '2',
            type: 'topic',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });

      run(topic, 'deleteRecord');
      run(function () {
        topic.get('users').then(async(function (fetchedUsers) {
          equal(fetchedUsers.get('length'), 1, 'Users are still there');
        }));
        user.get('topics').then(async(function (fetchedTopics) {
          equal(fetchedTopics.get('length'), 0, 'Topic got removed from the user');
          equal(fetchedTopics.objectAt(0), null, 'Topic can\'t be fetched');
        }));
      });
    });

    test('Deleting a record that has a hasMany relationship removes it from the otherMany array but does not remove the other record from itself - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
      });

      run(account, 'deleteRecord');
      equal(account.get('users.length'), 1, 'Users are still there');
      equal(user.get('accounts.length'), 0, 'Acocount got removed from the user');
    });

    /*
      Rollback Attributes tests
    */

    test('Rollbacking attributes for a deleted record that has a ManyToMany relationship works correctly - async', function () {
      var user, topic;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              topics: {
                data: [{
                  id: '2',
                  type: 'topic'
                }]
              }
            }
          }
        });
        topic = store.push({
          data: {
            id: '2',
            type: 'topic',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });

      run(function () {
        topic.deleteRecord();
        topic.rollbackAttributes();
      });
      run(function () {
        topic.get('users').then(async(function (fetchedUsers) {
          equal(fetchedUsers.get('length'), 1, 'Users are still there');
        }));
        user.get('topics').then(async(function (fetchedTopics) {
          equal(fetchedTopics.get('length'), 1, 'Topic got rollbacked into the user');
        }));
      });
    });

    test('Deleting a record that has a hasMany relationship removes it from the otherMany array but does not remove the other record from itself - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
      });

      run(function () {
        account.deleteRecord();
        account.rollbackAttributes();
      });
      equal(account.get('users.length'), 1, 'Users are still there');
      equal(user.get('accounts.length'), 1, 'Account got rolledback correctly into the user');
    });

    test('Rollbacking attributes for a created record that has a ManyToMany relationship works correctly - async', function () {
      var user, topic;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });

        topic = store.createRecord('topic');
      });
      run(function () {
        user.get('topics').then(async(function (fetchedTopics) {
          fetchedTopics.pushObject(topic);
          topic.rollbackAttributes();
          topic.get('users').then(async(function (fetchedUsers) {
            equal(fetchedUsers.get('length'), 0, 'Users got removed');
            equal(fetchedUsers.objectAt(0), null, 'User can\'t be fetched');
          }));
          user.get('topics').then(async(function (fetchedTopics) {
            equal(fetchedTopics.get('length'), 0, 'Topics got removed');
            equal(fetchedTopics.objectAt(0), null, 'Topic can\'t be fetched');
          }));
        }));
      });
    });

    test('Deleting a record that has a hasMany relationship removes it from the otherMany array but does not remove the other record from itself - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });

        user = store.createRecord('user');
      });
      run(function () {
        account.get('users').pushObject(user);
        user.rollbackAttributes();
      });
      equal(account.get('users.length'), 0, 'Users got removed');
      equal(user.get('accounts.length'), undefined, 'Accounts got rolledback correctly');
    });

    test('Re-loading a removed record should re add it to the relationship when the removed record is the last one in the relationship', function () {
      var account, ada, byron;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'account 1'
            }
          }
        });
        ada = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Ada Lovelace'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
        byron = store.push({
          data: {
            id: '2',
            type: 'user',
            attributes: {
              name: 'Lord Byron'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
        account.get('users').removeObject(byron);
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'account 1'
            },
            relationships: {
              users: {
                data: [{
                  id: '1',
                  type: 'user'
                }, {
                  id: '2',
                  type: 'user'
                }]
              }
            }
          }
        });
      });

      equal(account.get('users.length'), 2, 'Accounts were updated correctly');
    });
  }
);


define(
  "ember-data/tests/integration/relationships/one-to-many-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, User, Message, Account;
    var get = Ember.get;
    var run = Ember.run;

    var attr = DS.attr;
    var hasMany = DS.hasMany;
    var belongsTo = DS.belongsTo;

    function stringify(string) {
      return function () {
        return string;
      };
    }

    module('integration/relationships/one_to_many_test - OneToMany relationships', {
      setup: function () {
        User = DS.Model.extend({
          name: attr('string'),
          messages: hasMany('message', { async: true }),
          accounts: hasMany('account', { async: false })
        });
        User.toString = stringify('User');

        Account = DS.Model.extend({
          state: attr(),
          user: belongsTo('user', { async: false })
        });
        Account.toString = stringify('Account');

        Message = DS.Model.extend({
          title: attr('string'),
          user: belongsTo('user', { async: true })
        });
        Message.toString = stringify('Message');

        env = setupStore({
          user: User,
          message: Message,
          account: Account
        });

        store = env.store;
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    /*
      Server loading tests
    */

    test('Relationship is available from the belongsTo side even if only loaded from the hasMany side - async', function () {
      var user, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '2',
                  type: 'message'
                }]
              }
            }
          }
        });
        message = store.push({
          data: {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });
      run(function () {
        message.get('user').then(function (fetchedUser) {
          equal(fetchedUser, user, 'User relationship was set up correctly');
        });
      });
    });

    test('Relationship is available from the belongsTo side even if only loaded from the hasMany side - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
      });
      equal(account.get('user'), user, 'User relationship was set up correctly');
    });

    test('Relationship is available from the hasMany side even if only loaded from the belongsTo side - async', function () {
      var user, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
        message = store.push({
          data: {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
      });
      run(function () {
        user.get('messages').then(function (fetchedMessages) {
          equal(fetchedMessages.objectAt(0), message, 'Messages relationship was set up correctly');
        });
      });
    });

    test('Relationship is available from the hasMany side even if only loaded from the belongsTo side - sync', function () {
      var user, account;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
      });
      equal(user.get('accounts').objectAt(0), account, 'Accounts relationship was set up correctly');
    });

    test('Fetching a belongsTo that is set to null removes the record from a relationship - async', function () {
      var user;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '1',
                  type: 'message'
                }, {
                  id: '2',
                  type: 'message'
                }]
              }
            }
          }
        });
      });
      run(function () {
        store.push({
          data: [{
            id: '1',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }, {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberConf will be better'
            },
            relationships: {
              user: {
                data: null
              }
            }
          }]
        });
      });
      run(function () {
        user.get('messages').then(function (fetchedMessages) {
          equal(get(fetchedMessages, 'length'), 1, 'Messages relationship was set up correctly');
        });
      });
    });

    test('Fetching a belongsTo that is set to null removes the record from a relationship - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            },
            relationships: {
              user: {
                data: null
              }
            }
          }
        });
      });
      equal(user.get('accounts').objectAt(0), null, 'Account was sucesfully removed');
    });

    test('Fetching a belongsTo that is not defined does not remove the record from a relationship - async', function () {
      var user;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '1',
                  type: 'message'
                }, {
                  id: '2',
                  type: 'message'
                }]
              }
            }
          }
        });
      });
      run(function () {
        store.push({
          data: [{
            id: '1',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }, {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberConf will be better'
            }
          }]
        });
      });
      run(function () {
        user.get('messages').then(function (fetchedMessages) {
          equal(get(fetchedMessages, 'length'), 2, 'Messages relationship was set up correctly');
        });
      });
    });

    test('Fetching a belongsTo that is not defined does not remove the record from a relationship - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
      });
      equal(user.get('accounts').objectAt(0), account, 'Account was sucesfully removed');
    });

    test('Fetching the hasMany that doesn\'t contain the belongsTo, sets the belongsTo to null - async', function () {
      var user, message, message2;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '1',
                  type: 'message'
                }]
              }
            }
          }
        });
        message = store.push({
          data: {
            id: '1',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
        message2 = store.push({
          data: {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberConf is gonna be better'
            }
          }
        });
      });
      run(function () {
        store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '2',
                  type: 'message'
                }]
              }
            }
          }
        });
      });
      run(function () {
        message.get('user').then(function (fetchedUser) {
          equal(fetchedUser, null, 'User was removed correctly');
        });

        message2.get('user').then(function (fetchedUser) {
          equal(fetchedUser, user, 'User was set on the second message');
        });
      });
    });

    test('Fetching the hasMany that doesn\'t contain the belongsTo, sets the belongsTo to null - sync', function () {
      var account;
      run(function () {
        store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '1',
                  type: 'account'
                }]
              }
            }
          }
        });
        account = store.push({
          data: {
            id: '1',
            type: 'account',
            attributes: {
              state: 'great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
        store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'awesome'
            }
          }
        });
        store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
      });
      equal(account.get('user'), null, 'User was removed correctly');
    });

    test('Fetching the hasMany side where the hasMany is undefined does not change the belongsTo side - async', function () {
      var message, user;
      run(function () {
        store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '1',
                  type: 'message'
                }]
              }
            }
          }
        });
        message = store.push({
          data: {
            id: '1',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
      });

      run(function () {
        message.get('user').then(function (fetchedUser) {
          equal(fetchedUser, user, 'User was not removed');
        });
      });
    });

    test('Fetching the hasMany side where the hasMany is undefined does not change the belongsTo side - sync', function () {
      var account, user;
      run(function () {
        store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '1',
                  type: 'account'
                }]
              }
            }
          }
        });
        account = store.push({
          data: {
            id: '1',
            type: 'account',
            attributes: {
              state: 'great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
        store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'awesome'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
      });

      equal(account.get('user'), user, 'User was not removed');
    });

    /*
      Local edits
    */

    test('Pushing to the hasMany reflects the change on the belongsTo side - async', function () {
      var user, message2;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '1',
                  type: 'message'
                }]
              }
            }
          }
        });
        store.push({
          data: {
            id: '1',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
        message2 = store.push({
          data: {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });

      run(function () {
        user.get('messages').then(function (fetchedMessages) {
          fetchedMessages.pushObject(message2);
          message2.get('user').then(function (fetchedUser) {
            equal(fetchedUser, user, 'user got set correctly');
          });
        });
      });
    });

    test('Pushing to the hasMany reflects the change on the belongsTo side - sync', function () {
      var user, account2;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '1',
                  type: 'account'
                }]
              }
            }
          }
        });
        store.push({
          data: {
            id: '1',
            type: 'account',
            attributes: {
              state: 'great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });

        account2 = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'awesome'
            }
          }
        });
        user.get('accounts').pushObject(account2);
      });

      equal(account2.get('user'), user, 'user got set correctly');
    });

    test('Removing from the hasMany side reflects the change on the belongsTo side - async', function () {
      var user, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '1',
                  type: 'message'
                }]
              }
            }
          }
        });
        message = store.push({
          data: {
            id: '1',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });

      run(function () {
        user.get('messages').then(function (fetchedMessages) {
          fetchedMessages.removeObject(message);
          message.get('user').then(function (fetchedUser) {
            equal(fetchedUser, null, 'user got removed correctly');
          });
        });
      });
    });

    test('Removing from the hasMany side reflects the change on the belongsTo side - sync', function () {
      var user, account;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attirbutes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '1',
                  type: 'account'
                }]
              }
            }
          }
        });
        account = store.push({
          data: {
            id: '1',
            type: 'account',
            attirbutes: {
              state: 'great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
      });
      run(function () {
        user.get('accounts').removeObject(account);
      });

      equal(account.get('user'), null, 'user got removed correctly');
    });

    test('Pushing to the hasMany side keeps the oneToMany invariant on the belongsTo side - async', function () {
      expect(2);
      var user, user2, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '1',
                  type: 'message'
                }]
              }
            }
          }
        });
        user2 = store.push({
          data: {
            id: '2',
            type: 'user',
            attributes: {
              name: 'Tomhuda'
            }
          }
        });
        message = store.push({
          data: {
            id: '1',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });

      run(function () {
        user2.get('messages').then(function (fetchedMessages) {
          fetchedMessages.pushObject(message);

          message.get('user').then(function (fetchedUser) {
            equal(fetchedUser, user2, 'user got set correctly');
          });

          user.get('messages').then(function (newFetchedMessages) {
            equal(get(newFetchedMessages, 'length'), 0, 'message got removed from the old messages hasMany');
          });
        });
      });
    });

    test('Pushing to the hasMany side keeps the oneToMany invariant - sync', function () {
      var user, user2, account;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '1',
                  type: 'account'
                }]
              }
            }
          }
        });
        user2 = store.push({
          data: {
            id: '2',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
        account = store.push({
          data: {
            id: '1',
            type: 'account',
            attributes: {
              state: 'great'
            }
          }
        });
        user2.get('accounts').pushObject(account);
      });
      equal(account.get('user'), user2, 'user got set correctly');
      equal(user.get('accounts.length'), 0, 'the account got removed correctly');
      equal(user2.get('accounts.length'), 1, 'the account got pushed correctly');
    });

    test('Setting the belongsTo side keeps the oneToMany invariant on the hasMany- async', function () {
      expect(2);
      var user, user2, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '1',
                  type: 'message'
                }]
              }
            }
          }
        });
        user2 = store.push({
          data: {
            id: '2',
            type: 'user',
            attributes: {
              name: 'Tomhuda'
            }
          }
        });
        message = store.push({
          data: {
            id: '1',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
        message.set('user', user2);
      });

      run(function () {
        user.get('messages').then(function (fetchedMessages) {
          equal(get(fetchedMessages, 'length'), 0, 'message got removed from the first user correctly');
        });
      });
      run(function () {
        user2.get('messages').then(function (fetchedMessages) {
          equal(get(fetchedMessages, 'length'), 1, 'message got added to the second user correctly');
        });
      });
    });

    test('Setting the belongsTo side keeps the oneToMany invariant on the hasMany- sync', function () {
      var user, user2, account;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '1',
                  type: 'account'
                }]
              }
            }
          }
        });
        user2 = store.push({
          data: {
            id: '2',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
        account = store.push({
          data: {
            id: '1',
            type: 'account',
            attributes: {
              state: 'great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
        account.set('user', user2);
      });
      equal(account.get('user'), user2, 'user got set correctly');
      equal(user.get('accounts.length'), 0, 'the account got removed correctly');
      equal(user2.get('accounts.length'), 1, 'the account got pushed correctly');
    });

    test('Setting the belongsTo side to null removes the record from the hasMany side - async', function () {
      expect(2);
      var user, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '1',
                  type: 'message'
                }]
              }
            }
          }
        });
        message = store.push({
          data: {
            id: '1',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
        message.set('user', null);
      });
      run(function () {
        user.get('messages').then(function (fetchedMessages) {
          equal(get(fetchedMessages, 'length'), 0, 'message got removed from the  user correctly');
        });
      });

      run(function () {
        message.get('user').then(function (fetchedUser) {
          equal(fetchedUser, null, 'user got set to null correctly');
        });
      });
    });

    test('Setting the belongsTo side to null removes the record from the hasMany side - sync', function () {
      var user, account;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '1',
                  type: 'account'
                }]
              }
            }
          }
        });
        account = store.push({
          data: {
            id: '1',
            type: 'account',
            attributes: {
              state: 'great'
            },
            relationships: {
              user: {
                data: {
                  id: '1',
                  type: 'user'
                }
              }
            }
          }
        });
        account.set('user', null);
      });

      equal(account.get('user'), null, 'user got set to null correctly');

      equal(user.get('accounts.length'), 0, 'the account got removed correctly');
    });

    /*
    Deleting
    */

    test('When deleting a record that has a belongsTo it is removed from the hasMany side but not the belongsTo side- async', function () {
      var user, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '2',
                  type: 'message'
                }]
              }
            }
          }
        });
        message = store.push({
          data: {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });
      run(message, 'deleteRecord');
      run(function () {
        message.get('user').then(function (fetchedUser) {
          equal(fetchedUser, user, 'Message still has the user');
        });
        user.get('messages').then(function (fetchedMessages) {
          equal(fetchedMessages.get('length'), 0, 'User was removed from the messages');
          equal(fetchedMessages.get('firstObject'), null, 'Message can\'t be accessed');
        });
      });
    });

    test('When deleting a record that has a belongsTo it is removed from the hasMany side but not the belongsTo side- sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
        account.deleteRecord();
      });
      equal(user.get('accounts.length'), 0, 'User was removed from the accounts');
      equal(account.get('user'), user, 'Account still has the user');
    });

    test('When deleting a record that has a hasMany it is removed from the belongsTo side but not the hasMany side- async', function () {
      var user, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '2',
                  type: 'message'
                }]
              }
            }
          }
        });
        message = store.push({
          data: {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });
      run(user, 'deleteRecord');
      run(function () {
        message.get('user').then(function (fetchedUser) {
          equal(fetchedUser, null, 'Message does not have the user anymore');
        });
        user.get('messages').then(function (fetchedMessages) {
          equal(fetchedMessages.get('length'), 1, 'User still has the messages');
        });
      });
    });

    test('When deleting a record that has a hasMany it is removed from the belongsTo side but not the hasMany side - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
      });
      run(function () {
        user.deleteRecord();
      });
      equal(user.get('accounts.length'), 1, 'User still has the accounts');
      equal(account.get('user'), null, 'Account no longer has the user');
    });

    /*
    Rollback attributes from deleted state
    */

    test('Rollbacking attributes of a deleted record works correctly when the hasMany side has been deleted - async', function () {
      var user, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '2',
                  type: 'message'
                }]
              }
            }
          }
        });
        message = store.push({
          data: {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });
      run(function () {
        message.deleteRecord();
        message.rollbackAttributes();
      });
      run(function () {
        message.get('user').then(function (fetchedUser) {
          equal(fetchedUser, user, 'Message still has the user');
        });
        user.get('messages').then(function (fetchedMessages) {
          equal(fetchedMessages.objectAt(0), message, 'User has the message');
        });
      });
    });

    test('Rollbacking attributes of a deleted record works correctly when the hasMany side has been deleted - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
      });
      run(function () {
        account.deleteRecord();
        account.rollbackAttributes();
      });
      equal(user.get('accounts.length'), 1, 'Accounts are rolled back');
      equal(account.get('user'), user, 'Account still has the user');
    });

    test('Rollbacking attributes of deleted record works correctly when the belongsTo side has been deleted - async', function () {
      var user, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              messages: {
                data: [{
                  id: '2',
                  type: 'message'
                }]
              }
            }
          }
        });
        message = store.push({
          data: {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
      });
      run(function () {
        user.deleteRecord();
        user.rollbackAttributes();
      });
      run(function () {
        message.get('user').then(function (fetchedUser) {
          equal(fetchedUser, user, 'Message has the user again');
        });
        user.get('messages').then(function (fetchedMessages) {
          equal(fetchedMessages.get('length'), 1, 'User still has the messages');
        });
      });
    });

    test('Rollbacking attributes of a deleted record works correctly when the belongsTo side has been deleted - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              accounts: {
                data: [{
                  id: '2',
                  type: 'account'
                }]
              }
            }
          }
        });
      });
      run(function () {
        user.deleteRecord();
        user.rollbackAttributes();
      });
      equal(user.get('accounts.length'), 1, 'User still has the accounts');
      equal(account.get('user'), user, 'Account has the user again');
    });

    /*
    Rollback attributes from created state
    */

    test('Rollbacking attributes of a created record works correctly when the hasMany side has been created - async', function () {
      var user, message;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
        message = store.createRecord('message', {
          user: user
        });
      });
      run(message, 'rollbackAttributes');
      run(function () {
        message.get('user').then(function (fetchedUser) {
          equal(fetchedUser, null, 'Message does not have the user anymore');
        });
        user.get('messages').then(function (fetchedMessages) {
          equal(fetchedMessages.get('length'), 0, message, 'User does not have the message anymore');
          equal(fetchedMessages.get('firstObject'), null, 'User message can\'t be accessed');
        });
      });
    });

    test('Rollbacking attributes of a created record works correctly when the hasMany side has been created - sync', function () {
      var user, account;
      run(function () {
        user = store.push({
          data: {
            id: '1',
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
        account = store.createRecord('account', {
          user: user
        });
      });
      run(account, 'rollbackAttributes');
      equal(user.get('accounts.length'), 0, 'Accounts are rolled back');
      equal(account.get('user'), null, 'Account does not have the user anymore');
    });

    test('Rollbacking attributes of a created record works correctly when the belongsTo side has been created - async', function () {
      var message, user;
      run(function () {
        message = store.push({
          data: {
            id: '2',
            type: 'message',
            attributes: {
              title: 'EmberFest was great'
            }
          }
        });
        user = store.createRecord('user');
      });
      run(function () {
        user.get('messages').then(function (messages) {
          messages.pushObject(message);
          user.rollbackAttributes();
          message.get('user').then(function (fetchedUser) {
            equal(fetchedUser, null, 'Message does not have the user anymore');
          });
          user.get('messages').then(function (fetchedMessages) {
            equal(fetchedMessages.get('length'), 0, 'User does not have the message anymore');
            equal(fetchedMessages.get('firstObject'), null, 'User message can\'t be accessed');
          });
        });
      });
    });

    test('Rollbacking attributes of a created record works correctly when the belongsTo side has been created - sync', function () {
      var account, user;
      run(function () {
        account = store.push({
          data: {
            id: '2',
            type: 'account',
            attributes: {
              state: 'lonely'
            }
          }
        });
        user = store.createRecord('user');
      });
      run(function () {
        user.get('accounts').pushObject(account);
      });
      run(user, 'rollbackAttributes');
      equal(user.get('accounts.length'), undefined, 'User does not have the account anymore');
      equal(account.get('user'), null, 'Account does not have the user anymore');
    });
  }
);


define(
  "ember-data/tests/integration/relationships/one-to-one-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, User, Job;
    var run = Ember.run;

    var attr = DS.attr;
    var belongsTo = DS.belongsTo;

    function stringify(string) {
      return function () {
        return string;
      };
    }

    module('integration/relationships/one_to_one_test - OneToOne relationships', {
      setup: function () {
        User = DS.Model.extend({
          name: attr('string'),
          bestFriend: belongsTo('user', { async: true, inverse: 'bestFriend' }),
          job: belongsTo('job', { async: false })
        });
        User.toString = stringify('User');

        Job = DS.Model.extend({
          isGood: attr(),
          user: belongsTo('user', { async: false })
        });
        Job.toString = stringify('Job');

        env = setupStore({
          user: User,
          job: Job
        });

        store = env.store;
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    /*
      Server loading tests
    */

    test('Relationship is available from both sides even if only loaded from one side - async', function () {
      var stanley, stanleysFriend;
      run(function () {
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 2,
                  type: 'user'
                }
              }
            }
          }
        });
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            }
          }
        });

        stanleysFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, stanley, 'User relationship was set up correctly');
        });
      });
    });

    test('Relationship is available from both sides even if only loaded from one side - sync', function () {
      var job, user;
      run(function () {
        job = store.push({
          data: {
            id: 2,
            type: 'job',
            attributes: {
              isGood: true
            }
          }
        });
        user = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              job: {
                data: {
                  id: 2,
                  type: 'job'
                }
              }
            }
          }
        });
      });
      console.log(user);
      equal(job.get('user'), user, 'User relationship was set up correctly');
    });

    test('Fetching a belongsTo that is set to null removes the record from a relationship - async', function () {
      var stanleysFriend;
      run(function () {
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 1,
                  type: 'user'
                }
              }
            }
          }
        });
        store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: null
              }
            }
          }
        });
        stanleysFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, null, 'User relationship was removed correctly');
        });
      });
    });

    test('Fetching a belongsTo that is set to null removes the record from a relationship - sync', function () {
      var job;
      run(function () {
        job = store.push({
          data: {
            id: 2,
            type: 'job',
            attributes: {
              isGood: true
            }
          }
        });
        store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              job: {
                data: {
                  id: 2,
                  type: 'job'
                }
              }
            }
          }
        });
      });
      run(function () {
        job = store.push({
          data: {
            id: 2,
            type: 'job',
            attributes: {
              isGood: true
            },
            relationships: {
              user: {
                data: null
              }
            }
          }
        });
      });
      equal(job.get('user'), null, 'User relationship was removed correctly');
    });

    test('Fetching a belongsTo that is set to a different record, sets the old relationship to null - async', function () {
      expect(3);
      var stanley, stanleysFriend;
      run(function () {
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 2,
                  type: 'user'
                }
              }
            }
          }
        });
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 1,
                  type: 'user'
                }
              }
            }
          }
        });

        stanleysFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, stanley, 'User relationship was initally setup correctly');
          var stanleysNewFriend;
          run(function () {
            stanleysNewFriend = store.push({
              data: {
                id: 3,
                type: 'user',
                attributes: {
                  name: 'Stanley\'s New friend'
                },
                relationships: {
                  bestFriend: {
                    data: {
                      id: 1,
                      type: 'user'
                    }
                  }
                }
              }
            });
          });

          stanley.get('bestFriend').then(function (fetchedNewFriend) {
            equal(fetchedNewFriend, stanleysNewFriend, 'User relationship was updated correctly');
          });

          stanleysFriend.get('bestFriend').then(function (fetchedOldFriend) {
            equal(fetchedOldFriend, null, 'The old relationship was set to null correctly');
          });
        });
      });
    });

    test('Fetching a belongsTo that is set to a different record, sets the old relationship to null - sync', function () {
      var job, user, newBetterJob;
      run(function () {
        job = store.push({
          data: {
            id: 2,
            type: 'job',
            attributes: {
              isGood: false
            }
          }
        });
        user = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              job: {
                data: {
                  id: 2,
                  type: 'job'
                }
              }
            }
          }
        });
      });
      equal(job.get('user'), user, 'Job and user initially setup correctly');
      run(function () {
        newBetterJob = store.push({
          data: {
            id: 3,
            type: 'job',
            attributes: {
              isGood: true
            },
            relationships: {
              user: {
                data: {
                  id: 1,
                  type: 'user'
                }
              }
            }
          }
        });
      });

      equal(user.get('job'), newBetterJob, 'Job updated correctly');
      equal(job.get('user'), null, 'Old relationship nulled out correctly');
      equal(newBetterJob.get('user'), user, 'New job setup correctly');
    });

    /*
      Local edits
    */

    test('Setting a OneToOne relationship reflects correctly on the other side- async', function () {
      var stanley, stanleysFriend;
      run(function () {
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            }
          }
        });
      });
      run(function () {
        stanley.set('bestFriend', stanleysFriend);
        stanleysFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, stanley, 'User relationship was updated correctly');
        });
      });
    });

    test('Setting a OneToOne relationship reflects correctly on the other side- sync', function () {
      var job, user;
      run(function () {
        job = store.push({
          data: {
            id: 2,
            type: 'job',
            attributes: {
              isGood: true
            }
          }
        });
        user = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
      });
      run(function () {
        user.set('job', job);
      });
      equal(job.get('user'), user, 'User relationship was set up correctly');
    });

    test('Setting a BelongsTo to a promise unwraps the promise before setting- async', function () {
      var stanley, stanleysFriend, newFriend;
      run(function () {
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 2,
                  type: 'user'
                }
              }
            }
          }
        });
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            }
          }
        });
        newFriend = store.push({
          data: {
            id: 3,
            type: 'user',
            attributes: {
              name: 'New friend'
            }
          }
        });
      });
      run(function () {
        newFriend.set('bestFriend', stanleysFriend.get('bestFriend'));
        stanley.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, newFriend, 'User relationship was updated correctly');
        });
        newFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, stanley, 'User relationship was updated correctly');
        });
      });
    });

    test('Setting a BelongsTo to a promise works when the promise returns null- async', function () {
      var igor, newFriend;
      run(function () {
        store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });
        igor = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Igor'
            }
          }
        });
        newFriend = store.push({
          data: {
            id: 3,
            type: 'user',
            attributes: {
              name: 'New friend'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 1,
                  type: 'user'
                }
              }
            }
          }
        });
      });
      run(function () {
        newFriend.set('bestFriend', igor.get('bestFriend'));
        newFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, null, 'User relationship was updated correctly');
        });
      });
    });

    test('Setting a BelongsTo to a promise that didn\'t come from a relationship errors out', function () {
      var stanley, igor;
      run(function () {
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 2,
                  type: 'user'
                }
              }
            }
          }
        });
        igor = store.push({
          data: {
            id: 3,
            type: 'user',
            attributes: {
              name: 'Igor'
            }
          }
        });
      });

      expectAssertion(function () {
        run(function () {
          stanley.set('bestFriend', Ember.RSVP.resolve(igor));
        });
      }, /You passed in a promise that did not originate from an EmberData relationship. You can only pass promises that come from a belongsTo or hasMany relationship to the get call./);
    });

    test('Setting a BelongsTo to a promise multiple times is resistant to race conditions- async', function () {
      expect(1);
      var stanley, igor, newFriend;
      run(function () {
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 2,
                  type: 'user'
                }
              }
            }
          }
        });
        igor = store.push({
          data: {
            id: 3,
            type: 'user',
            attributes: {
              name: 'Igor'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 5,
                  type: 'user'
                }
              }
            }
          }
        });
        newFriend = store.push({
          data: {
            id: 7,
            type: 'user',
            attributes: {
              name: 'New friend'
            }
          }
        });
      });

      env.adapter.findRecord = function (store, type, id, snapshot) {
        if (id === '5') {
          return Ember.RSVP.resolve({ id: 5, name: 'Igor\'s friend' });
        } else if (id === '2') {
          stop();
          return new Ember.RSVP.Promise(function (resolve, reject) {
            setTimeout(function () {
              start();
              resolve({ id: 2, name: 'Stanley\'s friend' });
            }, 1);
          });
        }
      };

      run(function () {
        newFriend.set('bestFriend', stanley.get('bestFriend'));
        newFriend.set('bestFriend', igor.get('bestFriend'));
        newFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser.get('name'), 'Igor\'s friend', 'User relationship was updated correctly');
        });
      });
    });

    test('Setting a OneToOne relationship to null reflects correctly on the other side - async', function () {
      var stanley, stanleysFriend;
      run(function () {
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 2,
                  type: 'user'
                }
              }
            }
          }
        });
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 1,
                  type: 'user'
                }
              }
            }
          }
        });
      });

      run(function () {
        stanley.set('bestFriend', null); // :(
        stanleysFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, null, 'User relationship was removed correctly');
        });
      });
    });

    test('Setting a OneToOne relationship to null reflects correctly on the other side - sync', function () {
      var job, user;
      run(function () {
        job = store.push({
          data: {
            id: 2,
            type: 'job',
            attributes: {
              isGood: false
            },
            relationships: {
              user: {
                data: {
                  id: 1,
                  type: 'user'
                }
              }
            }
          }
        });
        user = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              job: {
                data: {
                  id: 2,
                  type: 'job'
                }
              }
            }
          }
        });
      });

      run(function () {
        user.set('job', null);
      });
      equal(job.get('user'), null, 'User relationship was removed correctly');
    });

    test('Setting a belongsTo to a different record, sets the old relationship to null - async', function () {
      expect(3);

      var stanley, stanleysFriend;
      run(function () {
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 2,
                  type: 'user'
                }
              }
            }
          }
        });
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 1,
                  type: 'user'
                }
              }
            }
          }
        });

        stanleysFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, stanley, 'User relationship was initally setup correctly');
          var stanleysNewFriend = store.push({
            data: {
              id: 3,
              type: 'user',
              attributes: {
                name: 'Stanley\'s New friend'
              }
            }
          });

          run(function () {
            stanleysNewFriend.set('bestFriend', stanley);
          });

          stanley.get('bestFriend').then(function (fetchedNewFriend) {
            equal(fetchedNewFriend, stanleysNewFriend, 'User relationship was updated correctly');
          });

          stanleysFriend.get('bestFriend').then(function (fetchedOldFriend) {
            equal(fetchedOldFriend, null, 'The old relationship was set to null correctly');
          });
        });
      });
    });

    test('Setting a belongsTo to a different record, sets the old relationship to null - sync', function () {
      var job, user, newBetterJob;
      run(function () {
        job = store.push({
          data: {
            id: 2,
            type: 'job',
            attributes: {
              isGood: false
            }
          }
        });
        user = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              job: {
                data: {
                  id: 2,
                  type: 'job'
                }
              }
            }
          }
        });
      });

      equal(job.get('user'), user, 'Job and user initially setup correctly');

      run(function () {
        newBetterJob = store.push({
          data: {
            id: 3,
            type: 'job',
            attributes: {
              isGood: true
            }
          }
        });

        newBetterJob.set('user', user);
      });

      equal(user.get('job'), newBetterJob, 'Job updated correctly');
      equal(job.get('user'), null, 'Old relationship nulled out correctly');
      equal(newBetterJob.get('user'), user, 'New job setup correctly');
    });

    /*
    Deleting tests
    */

    test('When deleting a record that has a belongsTo relationship, the record is removed from the inverse but still has access to its own relationship - async', function () {
      // This observer is here to make sure that inverseRecord gets cleared, when
      // the record is deleted, before notifyRecordRelationshipRemoved() and in turn
      // notifyPropertyChange() gets called. If not properly cleared observers will
      // trigger with the old value of the relationship.
      User.reopen({
        bestFriendObserver: Ember.observer('bestFriend', function () {
          this.get('bestFriend');
        })
      });
      var stanleysFriend, stanley;

      run(function () {
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            }
          }
        });
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 2,
                  type: 'user'
                }
              }
            }
          }
        });
      });
      run(function () {
        stanley.deleteRecord();
        stanleysFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, null, 'Stanley got removed');
        });
        stanley.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, stanleysFriend, 'Stanleys friend did not get removed');
        });
      });
    });

    test('When deleting a record that has a belongsTo relationship, the record is removed from the inverse but still has access to its own relationship - sync', function () {
      var job, user;
      run(function () {
        job = store.push({
          data: {
            id: 2,
            type: 'job',
            attributes: {
              isGood: true
            }
          }
        });
        user = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              job: {
                data: {
                  id: 2,
                  type: 'job'
                }
              }
            }
          }
        });
      });
      run(function () {
        job.deleteRecord();
      });
      equal(user.get('job'), null, 'Job got removed from the user');
      equal(job.get('user'), user, 'Job still has the user');
    });

    /*
    Rollback attributes tests
    */

    test('Rollbacking attributes of deleted record restores the relationship on both sides - async', function () {
      var stanley, stanleysFriend;
      run(function () {
        stanley = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              bestFriend: {
                data: {
                  id: 2,
                  type: 'user'
                }
              }
            }
          }
        });
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            }
          }
        });
      });
      run(function () {
        stanley.deleteRecord();
      });
      run(function () {
        stanley.rollbackAttributes();
        stanleysFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, stanley, 'Stanley got rollbacked correctly');
        });
        stanley.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, stanleysFriend, 'Stanleys friend did not get removed');
        });
      });
    });

    test('Rollbacking attributes of deleted record restores the relationship on both sides - sync', function () {
      var job, user;
      run(function () {
        job = store.push({
          data: {
            id: 2,
            type: 'job',
            attributes: {
              isGood: true
            }
          }
        });
        user = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            },
            relationships: {
              job: {
                data: {
                  id: 2,
                  type: 'job'
                }
              }
            }
          }
        });
      });
      run(function () {
        job.deleteRecord();
        job.rollbackAttributes();
      });
      equal(user.get('job'), job, 'Job got rollbacked correctly');
      equal(job.get('user'), user, 'Job still has the user');
    });

    test('Rollbacking attributes of created record removes the relationship on both sides - async', function () {
      var stanleysFriend, stanley;
      run(function () {
        stanleysFriend = store.push({
          data: {
            id: 2,
            type: 'user',
            attributes: {
              name: 'Stanley\'s friend'
            }
          }
        });

        stanley = store.createRecord('user', { bestFriend: stanleysFriend });
      });
      run(function () {
        stanley.rollbackAttributes();
        stanleysFriend.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, null, 'Stanley got rollbacked correctly');
        });
        stanley.get('bestFriend').then(function (fetchedUser) {
          equal(fetchedUser, null, 'Stanleys friend did got removed');
        });
      });
    });

    test('Rollbacking attributes of created record removes the relationship on both sides - sync', function () {
      var user, job;
      run(function () {
        user = store.push({
          data: {
            id: 1,
            type: 'user',
            attributes: {
              name: 'Stanley'
            }
          }
        });

        job = store.createRecord('job', { user: user });
      });
      run(function () {
        job.rollbackAttributes();
      });
      equal(user.get('job'), null, 'Job got rollbacked correctly');
      equal(job.get('user'), null, 'Job does not have user anymore');
    });
  }
);


define(
  "ember-data/tests/integration/relationships/polymorphic-mixins-belongs-to-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, User, Message, Video, NotMessage;
    var run = Ember.run;

    var attr = DS.attr;
    var belongsTo = DS.belongsTo;

    function stringify(string) {
      return function () {
        return string;
      };
    }

    module('integration/relationships/polymorphic_mixins_belongs_to_test - Polymorphic belongsTo relationships with mixins', {
      setup: function () {
        User = DS.Model.extend({
          name: attr('string'),
          bestMessage: belongsTo('message', { async: true, polymorphic: true })
        });
        User.toString = stringify('User');

        Message = Ember.Mixin.create({
          title: attr('string'),
          user: belongsTo('user', { async: true })
        });
        Message.toString = stringify('Message');

        NotMessage = DS.Model.extend({
          video: attr()
        });

        Video = DS.Model.extend(Message, {
          video: attr()
        });

        env = setupStore({
          user: User,
          video: Video,
          notMessage: NotMessage
        });

        env.registry.register('mixin:message', Message);
        store = env.store;
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    /*
      Server loading tests
    */

    test('Relationship is available from the belongsTo side even if only loaded from the inverse side - async', function () {
      var user, video;
      run(function () {
        user = store.push('user', { id: 1, name: 'Stanley', bestMessage: 2, bestMessageType: 'video' });
        video = store.push('video', { id: 2, video: 'Here comes Youtube' });
      });
      run(function () {
        user.get('bestMessage').then(function (message) {
          equal(message, video, 'The message was loaded correctly');
          message.get('user').then(function (fetchedUser) {
            equal(fetchedUser, user, 'The inverse was setup correctly');
          });
        });
      });
    });

    /*
      Local edits
    */
    test('Setting the polymorphic belongsTo gets propagated to the inverse side - async', function () {
      var user, video;
      run(function () {
        user = store.push('user', { id: 1, name: 'Stanley' });
        video = store.push('video', { id: 2, video: 'Here comes Youtube' });
      });

      run(function () {
        user.set('bestMessage', video);
        video.get('user').then(function (fetchedUser) {
          equal(fetchedUser, user, 'user got set correctly');
        });
        user.get('bestMessage').then(function (message) {
          equal(message, video, 'The message was set correctly');
        });
      });
    });

    test('Setting the polymorphic belongsTo with an object that does not implement the mixin errors out', function () {
      var user, video;
      run(function () {
        user = store.push('user', { id: 1, name: 'Stanley' });
        video = store.push('not-message', { id: 2, video: 'Here comes Youtube' });
      });

      run(function () {
        expectAssertion(function () {
          user.set('bestMessage', video);
        }, /You cannot add a record of type 'not-message' to the 'user.bestMessage' relationship \(only 'message' allowed\)/);
      });
    });

    test('Setting the polymorphic belongsTo gets propagated to the inverse side - model injections true', function () {
      expect(2);
      var injectionValue = Ember.MODEL_FACTORY_INJECTIONS;
      Ember.MODEL_FACTORY_INJECTIONS = true;

      try {
        var user, video;
        run(function () {
          user = store.push('user', { id: 1, name: 'Stanley' });
          video = store.push('video', { id: 2, video: 'Here comes Youtube' });
        });

        run(function () {
          user.set('bestMessage', video);
          video.get('user').then(function (fetchedUser) {
            equal(fetchedUser, user, 'user got set correctly');
          });
          user.get('bestMessage').then(function (message) {
            equal(message, video, 'The message was set correctly');
          });
        });
      } finally {
        Ember.MODEL_FACTORY_INJECTIONS = injectionValue;
      }
    });

    test('Setting the polymorphic belongsTo with an object that does not implement the mixin errors out - model injections true', function () {
      var injectionValue = Ember.MODEL_FACTORY_INJECTIONS;
      Ember.MODEL_FACTORY_INJECTIONS = true;

      try {
        var user, video;
        run(function () {
          user = store.push('user', { id: 1, name: 'Stanley' });
          video = store.push('not-message', { id: 2, video: 'Here comes Youtube' });
        });

        run(function () {
          expectAssertion(function () {
            user.set('bestMessage', video);
          }, /You cannot add a record of type 'not-message' to the 'user.bestMessage' relationship \(only 'message' allowed\)/);
        });
      } finally {
        Ember.MODEL_FACTORY_INJECTIONS = injectionValue;
      }
    });
  }
);


define(
  "ember-data/tests/integration/relationships/polymorphic-mixins-has-many-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, User, Message, NotMessage, Video;
    var run = Ember.run;

    var attr = DS.attr;
    var hasMany = DS.hasMany;
    var belongsTo = DS.belongsTo;

    function stringify(string) {
      return function () {
        return string;
      };
    }

    module('integration/relationships/polymorphic_mixins_has_many_test - Polymorphic hasMany relationships with mixins', {
      setup: function () {
        User = DS.Model.extend({
          name: attr('string'),
          messages: hasMany('message', { async: true, polymorphic: true })
        });
        User.toString = stringify('User');

        Message = Ember.Mixin.create({
          title: attr('string'),
          user: belongsTo('user', { async: true })
        });
        Message.toString = stringify('Message');

        Video = DS.Model.extend(Message, {
          video: attr()
        });

        NotMessage = DS.Model.extend({
          video: attr()
        });

        env = setupStore({
          user: User,
          video: Video,
          notMessage: NotMessage
        });

        env.registry.register('mixin:message', Message);
        store = env.store;
      },

      teardown: function () {
        run(env.container, 'destroy');
      }
    });

    /*
      Server loading tests
    */

    test('Relationship is available from the belongsTo side even if only loaded from the hasMany side - async', function () {
      var user, video;
      run(function () {
        user = store.push('user', { id: 1, name: 'Stanley', messages: [{ id: 2, type: 'video' }] });
        video = store.push('video', { id: 2, video: 'Here comes Youtube' });
      });
      run(function () {
        user.get('messages').then(function (messages) {
          equal(messages.objectAt(0), video, 'The hasMany has loaded correctly');
          messages.objectAt(0).get('user').then(function (fetchedUser) {
            equal(fetchedUser, user, 'The inverse was setup correctly');
          });
        });
      });
    });

    /*
      Local edits
    */
    test('Pushing to the hasMany reflects the change on the belongsTo side - async', function () {
      var user, video;
      run(function () {
        user = store.push('user', { id: 1, name: 'Stanley', messages: [] });
        video = store.push('video', { id: 2, video: 'Here comes Youtube' });
      });

      run(function () {
        user.get('messages').then(function (fetchedMessages) {
          fetchedMessages.pushObject(video);
          video.get('user').then(function (fetchedUser) {
            equal(fetchedUser, user, 'user got set correctly');
          });
        });
      });
    });

    /*
      Local edits
    */
    test('Pushing a an object that does not implement the mixin to the mixin accepting array errors out', function () {
      var user, notMessage;
      run(function () {
        user = store.push('user', { id: 1, name: 'Stanley', messages: [] });
        notMessage = store.push('not-message', { id: 2, video: 'Here comes Youtube' });
      });

      run(function () {
        user.get('messages').then(function (fetchedMessages) {
          expectAssertion(function () {
            fetchedMessages.pushObject(notMessage);
          }, /You cannot add a record of type 'not-message' to the 'user.messages' relationship \(only 'message' allowed\)/);
        });
      });
    });

    test('Pushing to the hasMany reflects the change on the belongsTo side - model injections true', function () {
      var injectionValue = Ember.MODEL_FACTORY_INJECTIONS;
      Ember.MODEL_FACTORY_INJECTIONS = true;

      try {
        var user, video;
        run(function () {
          user = store.push('user', { id: 1, name: 'Stanley', messages: [] });
          video = store.push('video', { id: 2, video: 'Here comes Youtube' });
        });

        run(function () {
          user.get('messages').then(function (fetchedMessages) {
            fetchedMessages.pushObject(video);
            video.get('user').then(function (fetchedUser) {
              equal(fetchedUser, user, 'user got set correctly');
            });
          });
        });
      } finally {
        Ember.MODEL_FACTORY_INJECTIONS = injectionValue;
      }
    });

    /*
      Local edits
    */
    test('Pushing a an object that does not implement the mixin to the mixin accepting array errors out - model injections true', function () {
      var injectionValue = Ember.MODEL_FACTORY_INJECTIONS;
      Ember.MODEL_FACTORY_INJECTIONS = true;

      try {
        var user, notMessage;
        run(function () {
          user = store.push('user', { id: 1, name: 'Stanley', messages: [] });
          notMessage = store.push('not-message', { id: 2, video: 'Here comes Youtube' });
        });

        run(function () {
          user.get('messages').then(function (fetchedMessages) {
            expectAssertion(function () {
              fetchedMessages.pushObject(notMessage);
            }, /You cannot add a record of type 'not-message' to the 'user.messages' relationship \(only 'message' allowed\)/);
          });
        });
      } finally {
        Ember.MODEL_FACTORY_INJECTIONS = injectionValue;
      }
    });
  }
);


define(
  "ember-data/tests/integration/serializers/embedded-records-mixin-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var HomePlanet, SuperVillain, EvilMinion, SecretLab, SecretWeapon, BatCave, Comment, league, superVillain, evilMinion, secretWeapon, homePlanet, secretLab, env;
    var run = Ember.run;
    var LightSaber;

    module('integration/embedded_records_mixin - EmbeddedRecordsMixin', {
      setup: function () {
        SuperVillain = DS.Model.extend({
          firstName: DS.attr('string'),
          lastName: DS.attr('string'),
          homePlanet: DS.belongsTo('home-planet', { inverse: 'villains', async: true }),
          secretLab: DS.belongsTo('secret-lab', { async: false }),
          secretWeapons: DS.hasMany('secret-weapon', { async: false }),
          evilMinions: DS.hasMany('evil-minion', { async: false })
        });
        HomePlanet = DS.Model.extend({
          name: DS.attr('string'),
          villains: DS.hasMany('super-villain', { inverse: 'homePlanet', async: false })
        });
        SecretLab = DS.Model.extend({
          minionCapacity: DS.attr('number'),
          vicinity: DS.attr('string'),
          superVillain: DS.belongsTo('super-villain', { async: false })
        });
        BatCave = SecretLab.extend({
          infiltrated: DS.attr('boolean')
        });
        SecretWeapon = DS.Model.extend({
          name: DS.attr('string'),
          superVillain: DS.belongsTo('super-villain', { async: false })
        });
        LightSaber = SecretWeapon.extend({
          color: DS.attr('string')
        });
        EvilMinion = DS.Model.extend({
          superVillain: DS.belongsTo('super-villain', { async: false }),
          name: DS.attr('string')
        });
        Comment = DS.Model.extend({
          body: DS.attr('string'),
          root: DS.attr('boolean'),
          children: DS.hasMany('comment', { inverse: null, async: false })
        });
        env = setupStore({
          superVillain: SuperVillain,
          homePlanet: HomePlanet,
          secretLab: SecretLab,
          batCave: BatCave,
          secretWeapon: SecretWeapon,
          lightSaber: LightSaber,
          evilMinion: EvilMinion,
          comment: Comment
        });
        env.store.modelFor('super-villain');
        env.store.modelFor('home-planet');
        env.store.modelFor('secret-lab');
        env.store.modelFor('bat-cave');
        env.store.modelFor('secret-weapon');
        env.store.modelFor('light-saber');
        env.store.modelFor('evil-minion');
        env.store.modelFor('comment');

        env.registry.register('adapter:application', DS.RESTAdapter);
        env.registry.register('serializer:application', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin));

        //env.amsSerializer = env.container.lookup("serializer:-active-model");
        //env.amsAdapter    = env.container.lookup("adapter:-active-model");
      },

      teardown: function () {
        run(env.store, 'destroy');
      }
    });

    test('normalizeResponse with embedded objects', function () {
      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('home-planet');
      var json_hash = {
        homePlanet: {
          id: '1',
          name: 'Umber',
          villains: [{
            id: '2',
            firstName: 'Tom',
            lastName: 'Dale'
          }]
        }
      };
      var json;

      run(function () {
        json = serializer.normalizeResponse(env.store, HomePlanet, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'home-planet',
          'attributes': {
            'name': 'Umber'
          },
          'relationships': {
            'villains': {
              'data': [{ 'id': '2', 'type': 'super-villain' }]
            }
          }
        },
        'included': [{
          'id': '2',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'relationships': {}
        }]
      });
    });

    test('normalizeResponse with embedded objects inside embedded objects', function () {
      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' }
        }
      }));
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          evilMinions: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('home-planet');
      var json_hash = {
        homePlanet: {
          id: '1',
          name: 'Umber',
          villains: [{
            id: '2',
            firstName: 'Tom',
            lastName: 'Dale',
            evilMinions: [{
              id: '3',
              name: 'Alex'
            }]
          }]
        }
      };
      var json;

      run(function () {
        json = serializer.normalizeResponse(env.store, HomePlanet, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'home-planet',
          'attributes': {
            'name': 'Umber'
          },
          'relationships': {
            'villains': {
              'data': [{ 'id': '2', 'type': 'super-villain' }]
            }
          }
        },
        'included': [{
          'id': '2',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'relationships': {
            'evilMinions': {
              'data': [{ 'id': '3', 'type': 'evil-minion' }]
            }
          }
        }, {
          'id': '3',
          'type': 'evil-minion',
          'attributes': {
            'name': 'Alex'
          },
          'relationships': {}
        }]
      });
    });

    test('normalizeResponse with embedded objects of same type', function () {
      env.registry.register('serializer:comment', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          children: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('comment');

      var json_hash = {
        comment: {
          id: '1',
          body: 'Hello',
          root: true,
          children: [{
            id: '2',
            body: 'World',
            root: false
          }, {
            id: '3',
            body: 'Foo',
            root: false
          }]
        }
      };
      var json;
      run(function () {
        json = serializer.normalizeResponse(env.store, Comment, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'comment',
          'attributes': {
            'body': 'Hello',
            'root': true
          },
          'relationships': {
            'children': {
              'data': [{ 'id': '2', 'type': 'comment' }, { 'id': '3', 'type': 'comment' }]
            }
          }
        },
        'included': [{
          'id': '2',
          'type': 'comment',
          'attributes': {
            'body': 'World',
            'root': false
          },
          'relationships': {}
        }, {
          'id': '3',
          'type': 'comment',
          'attributes': {
            'body': 'Foo',
            'root': false
          },
          'relationships': {}
        }]
      }, 'Primary record was correct');
    });

    test('normalizeResponse with embedded objects inside embedded objects of same type', function () {
      env.registry.register('serializer:comment', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          children: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('comment');
      var json_hash = {
        comment: {
          id: '1',
          body: 'Hello',
          root: true,
          children: [{
            id: '2',
            body: 'World',
            root: false,
            children: [{
              id: '4',
              body: 'Another',
              root: false
            }]
          }, {
            id: '3',
            body: 'Foo',
            root: false
          }]
        }
      };
      var json;
      run(function () {
        json = serializer.normalizeResponse(env.store, Comment, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'comment',
          'attributes': {
            'body': 'Hello',
            'root': true
          },
          'relationships': {
            'children': {
              'data': [{ 'id': '2', 'type': 'comment' }, { 'id': '3', 'type': 'comment' }]
            }
          }
        },
        'included': [{
          'id': '2',
          'type': 'comment',
          'attributes': {
            'body': 'World',
            'root': false
          },
          'relationships': {
            'children': {
              'data': [{ 'id': '4', 'type': 'comment' }]
            }
          }
        }, {
          'id': '4',
          'type': 'comment',
          'attributes': {
            'body': 'Another',
            'root': false
          },
          'relationships': {}
        }, {
          'id': '3',
          'type': 'comment',
          'attributes': {
            'body': 'Foo',
            'root': false
          },
          'relationships': {}
        }]
      }, 'Primary record was correct');
    });

    test('normalizeResponse with embedded objects of same type, but from separate attributes', function () {
      HomePlanet.reopen({
        reformedVillains: DS.hasMany('superVillain', { inverse: null, async: false })
      });

      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' },
          reformedVillains: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('home-planet');
      var json_hash = {
        homePlanet: {
          id: '1',
          name: 'Earth',
          villains: [{
            id: '1',
            firstName: 'Tom'
          }, {
            id: '3',
            firstName: 'Yehuda'
          }],
          reformedVillains: [{
            id: '2',
            firstName: 'Alex'
          }, {
            id: '4',
            firstName: 'Erik'
          }]
        }
      };
      var json;
      run(function () {
        json = serializer.normalizeResponse(env.store, HomePlanet, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'home-planet',
          'attributes': {
            'name': 'Earth'
          },
          'relationships': {
            'villains': {
              'data': [{ 'id': '1', 'type': 'super-villain' }, { 'id': '3', 'type': 'super-villain' }]
            },
            'reformedVillains': {
              'data': [{ 'id': '2', 'type': 'super-villain' }, { 'id': '4', 'type': 'super-villain' }]
            }
          }
        },
        'included': [{
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom'
          },
          'relationships': {}
        }, {
          'id': '3',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Yehuda'
          },
          'relationships': {}
        }, {
          'id': '2',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Alex'
          },
          'relationships': {}
        }, {
          'id': '4',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Erik'
          },
          'relationships': {}
        }]
      }, 'Primary hash was correct');
    });

    test('normalizeResponse with embedded objects', function () {
      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('home-planet');

      var json_hash = {
        homePlanets: [{
          id: '1',
          name: 'Umber',
          villains: [{
            id: '1',
            firstName: 'Tom',
            lastName: 'Dale'
          }]
        }]
      };
      var array;

      run(function () {
        array = serializer.normalizeResponse(env.store, HomePlanet, json_hash, null, 'findAll');
      });

      deepEqual(array, {
        'data': [{
          'id': '1',
          'type': 'home-planet',
          'attributes': {
            'name': 'Umber'
          },
          'relationships': {
            'villains': {
              'data': [{ 'id': '1', 'type': 'super-villain' }]
            }
          }
        }],
        'included': [{
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'relationships': {}
        }]
      });
    });

    test('normalizeResponse with embedded objects with custom primary key', function () {
      expect(1);
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend({
        primaryKey: 'villain_id'
      }));
      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('home-planet');

      var json_hash = {
        homePlanets: [{
          id: '1',
          name: 'Umber',
          villains: [{
            villain_id: '2',
            firstName: 'Alex',
            lastName: 'Baizeau'
          }]
        }]
      };
      var array;

      run(function () {
        array = serializer.normalizeResponse(env.store, HomePlanet, json_hash, null, 'findAll');
      });

      deepEqual(array, {
        'data': [{
          'id': '1',
          'type': 'home-planet',
          'attributes': {
            'name': 'Umber'
          },
          'relationships': {
            'villains': {
              'data': [{ 'id': '2', 'type': 'super-villain' }]
            }
          }
        }],
        'included': [{
          'id': '2',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Alex',
            'lastName': 'Baizeau'
          },
          'relationships': {}
        }]
      });
    });

    test('normalizeResponse with embedded objects with identical relationship and attribute key ', function () {
      expect(1);
      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' }
        },
        //Makes the keyForRelationship and keyForAttribute collide.
        keyForRelationship: function (key, type) {
          return this.keyForAttribute(key, type);
        }
      }));

      var serializer = env.store.serializerFor('home-planet');

      var json_hash = {
        homePlanets: [{
          id: '1',
          name: 'Umber',
          villains: [{
            id: '1',
            firstName: 'Alex',
            lastName: 'Baizeau'
          }]
        }]
      };
      var array;

      run(function () {
        array = serializer.normalizeResponse(env.store, HomePlanet, json_hash, null, 'findAll');
      });

      deepEqual(array, {
        'data': [{
          'id': '1',
          'type': 'home-planet',
          'attributes': {
            'name': 'Umber'
          },
          'relationships': {
            'villains': {
              'data': [{ 'id': '1', 'type': 'super-villain' }]
            }
          }
        }],
        'included': [{
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Alex',
            'lastName': 'Baizeau'
          },
          'relationships': {}
        }]
      });
    });

    test('normalizeResponse with embedded objects of same type as primary type', function () {
      env.registry.register('serializer:comment', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          children: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('comment');

      var json_hash = {
        comments: [{
          id: '1',
          body: 'Hello',
          root: true,
          children: [{
            id: '2',
            body: 'World',
            root: false
          }, {
            id: '3',
            body: 'Foo',
            root: false
          }]
        }]
      };
      var array;

      run(function () {
        array = serializer.normalizeResponse(env.store, Comment, json_hash, null, 'findAll');
      });

      deepEqual(array, {
        'data': [{
          'id': '1',
          'type': 'comment',
          'attributes': {
            'body': 'Hello',
            'root': true
          },
          'relationships': {
            'children': {
              'data': [{ 'id': '2', 'type': 'comment' }, { 'id': '3', 'type': 'comment' }]
            }
          }
        }],
        'included': [{
          'id': '2',
          'type': 'comment',
          'attributes': {
            'body': 'World',
            'root': false
          },
          'relationships': {}
        }, {
          'id': '3',
          'type': 'comment',
          'attributes': {
            'body': 'Foo',
            'root': false
          },
          'relationships': {}
        }]
      }, 'Primary array is correct');
    });

    test('normalizeResponse with embedded objects of same type, but from separate attributes', function () {
      HomePlanet.reopen({
        reformedVillains: DS.hasMany('superVillain', { async: false })
      });

      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' },
          reformedVillains: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('home-planet');
      var json_hash = {
        homePlanets: [{
          id: '1',
          name: 'Earth',
          villains: [{
            id: '1',
            firstName: 'Tom'
          }, {
            id: '3',
            firstName: 'Yehuda'
          }],
          reformedVillains: [{
            id: '2',
            firstName: 'Alex'
          }, {
            id: '4',
            firstName: 'Erik'
          }]
        }, {
          id: '2',
          name: 'Mars',
          villains: [{
            id: '1',
            firstName: 'Tom'
          }, {
            id: '3',
            firstName: 'Yehuda'
          }],
          reformedVillains: [{
            id: '5',
            firstName: 'Peter'
          }, {
            id: '6',
            firstName: 'Trek'
          }]
        }]
      };

      var json;
      run(function () {
        json = serializer.normalizeResponse(env.store, HomePlanet, json_hash, null, 'findAll');
      });

      deepEqual(json, {
        'data': [{
          'id': '1',
          'type': 'home-planet',
          'attributes': {
            'name': 'Earth'
          },
          'relationships': {
            'reformedVillains': {
              'data': [{ 'id': '2', 'type': 'super-villain' }, { 'id': '4', 'type': 'super-villain' }]
            },
            'villains': {
              'data': [{ 'id': '1', 'type': 'super-villain' }, { 'id': '3', 'type': 'super-villain' }]
            }
          }
        }, {
          'id': '2',
          'type': 'home-planet',
          'attributes': {
            'name': 'Mars'
          },
          'relationships': {
            'reformedVillains': {
              'data': [{ 'id': '5', 'type': 'super-villain' }, { 'id': '6', 'type': 'super-villain' }]
            },
            'villains': {
              'data': [{ 'id': '1', 'type': 'super-villain' }, { 'id': '3', 'type': 'super-villain' }]
            }
          }
        }],
        'included': [{
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom'
          },
          'relationships': {}
        }, {
          'id': '3',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Yehuda'
          },
          'relationships': {}
        }, {
          'id': '2',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Alex'
          },
          'relationships': {}
        }, {
          'id': '4',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Erik'
          },
          'relationships': {}
        }, {
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom'
          },
          'relationships': {}
        }, {
          'id': '3',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Yehuda'
          },
          'relationships': {}
        }, {
          'id': '5',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Peter'
          },
          'relationships': {}
        }, {
          'id': '6',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Trek'
          },
          'relationships': {}
        }]
      }, 'Primary array was correct');
    });

    test('serialize supports serialize:false on non-relationship properties', function () {
      var tom;
      run(function () {
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', id: '1' });
      });

      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          firstName: { serialize: false }
        }
      }));
      var serializer, json;
      run(function () {
        serializer = env.store.serializerFor('super-villain');
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        lastName: 'Dale',
        homePlanet: null,
        secretLab: null
      });
    });

    test('serialize with embedded objects (hasMany relationship)', function () {
      var tom, league;
      run(function () {
        league = env.store.createRecord('home-planet', { name: 'Villain League', id: '123' });
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', homePlanet: league, id: '1' });
      });

      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' }
        }
      }));

      var serializer, json;
      run(function () {
        serializer = env.store.serializerFor('home-planet');

        json = serializer.serialize(league._createSnapshot());
      });

      deepEqual(json, {
        name: 'Villain League',
        villains: [{
          id: get(tom, 'id'),
          firstName: 'Tom',
          lastName: 'Dale',
          homePlanet: get(league, 'id'),
          secretLab: null
        }]
      });
    });

    test('serialize with embedded objects (unknown hasMany relationship)', function () {
      var league;
      run(function () {
        league = env.store.push('home-planet', { name: 'Villain League', id: '123' });
      });

      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' }
        }
      }));

      var serializer, json;
      warns(function () {
        run(function () {
          serializer = env.store.serializerFor('home-planet');
          json = serializer.serialize(league._createSnapshot());
        });
      }, /The embedded relationship 'villains' is undefined for 'home-planet' with id '123'. Please include it in your original payload./);

      deepEqual(json, {
        name: 'Villain League',
        villains: []
      });
    });

    test('serialize with embedded objects (hasMany relationship) supports serialize:false', function () {
      run(function () {
        league = env.store.createRecord('home-planet', { name: 'Villain League', id: '123' });
        env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', homePlanet: league, id: '1' });
      });

      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { serialize: false }
        }
      }));
      var serializer, json;
      run(function () {
        serializer = env.store.serializerFor('home-planet');

        json = serializer.serialize(league._createSnapshot());
      });

      deepEqual(json, {
        name: 'Villain League'
      });
    });

    test('serialize with (new) embedded objects (hasMany relationship)', function () {
      run(function () {
        league = env.store.createRecord('home-planet', { name: 'Villain League', id: '123' });
        env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', homePlanet: league });
      });

      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          villains: { embedded: 'always' }
        }
      }));
      var serializer, json;
      run(function () {
        serializer = env.store.serializerFor('home-planet');

        json = serializer.serialize(league._createSnapshot());
      });
      deepEqual(json, {
        name: 'Villain League',
        villains: [{
          firstName: 'Tom',
          lastName: 'Dale',
          homePlanet: get(league, 'id'),
          secretLab: null
        }]
      });
    });

    test('serialize with embedded objects (hasMany relationships, including related objects not embedded)', function () {
      run(function () {
        superVillain = env.store.createRecord('super-villain', { id: 1, firstName: 'Super', lastName: 'Villian' });
        evilMinion = env.store.createRecord('evil-minion', { id: 1, name: 'Evil Minion', superVillian: superVillain });
        secretWeapon = env.store.createRecord('secret-weapon', { id: 1, name: 'Secret Weapon', superVillain: superVillain });
        superVillain.get('evilMinions').pushObject(evilMinion);
        superVillain.get('secretWeapons').pushObject(secretWeapon);
      });

      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          evilMinions: { serialize: 'records', deserialize: 'records' },
          secretWeapons: { serialize: 'ids' }
        }
      }));
      var serializer, json;
      run(function () {
        serializer = env.container.lookup('serializer:super-villain');

        json = serializer.serialize(superVillain._createSnapshot());
      });
      deepEqual(json, {
        firstName: get(superVillain, 'firstName'),
        lastName: get(superVillain, 'lastName'),
        homePlanet: null,
        evilMinions: [{
          id: get(evilMinion, 'id'),
          name: get(evilMinion, 'name'),
          superVillain: '1'
        }],
        secretLab: null,
        secretWeapons: ['1']
      });
    });

    test('normalizeResponse with embedded object (belongsTo relationship)', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('super-villain');

      var json_hash = {
        super_villain: {
          id: '1',
          firstName: 'Tom',
          lastName: 'Dale',
          homePlanet: '123',
          evilMinions: ['1', '2', '3'],
          secretLab: {
            minionCapacity: 5000,
            vicinity: 'California, USA',
            id: '101'
          },
          secretWeapons: []
        }
      };
      var json;

      run(function () {
        json = serializer.normalizeResponse(env.store, SuperVillain, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'relationships': {
            'evilMinions': {
              'data': [{ 'id': '1', 'type': 'evil-minion' }, { 'id': '2', 'type': 'evil-minion' }, { 'id': '3', 'type': 'evil-minion' }]
            },
            'homePlanet': {
              'data': { 'id': '123', 'type': 'home-planet' }
            },
            'secretLab': {
              'data': { 'id': '101', 'type': 'secret-lab' }
            },
            'secretWeapons': {
              'data': []
            }
          }
        },
        'included': [{
          'id': '101',
          'type': 'secret-lab',
          'attributes': {
            'minionCapacity': 5000,
            'vicinity': 'California, USA'
          },
          'relationships': {}
        }]
      });
    });

    test('serialize with embedded object (belongsTo relationship)', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { embedded: 'always' }
        }
      }));
      var serializer, json, tom;
      run(function () {
        serializer = env.store.serializerFor('super-villain');

        // records with an id, persisted

        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', id: '1',
          secretLab: env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA', id: '101' }),
          homePlanet: env.store.createRecord('home-planet', { name: 'Villain League', id: '123' })
        });
      });

      run(function () {
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(tom, 'firstName'),
        lastName: get(tom, 'lastName'),
        homePlanet: get(tom, 'homePlanet').get('id'),
        secretLab: {
          id: get(tom, 'secretLab').get('id'),
          minionCapacity: get(tom, 'secretLab').get('minionCapacity'),
          vicinity: get(tom, 'secretLab').get('vicinity')
        }
      });
    });

    test('serialize with embedded object (belongsTo relationship) works with different primaryKeys', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        primaryKey: '_id',
        attrs: {
          secretLab: { embedded: 'always' }
        }
      }));
      env.registry.register('serializer:secret-lab', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        primaryKey: 'crazy_id'
      }));

      var serializer = env.store.serializerFor('super-villain');

      // records with an id, persisted
      var tom, json;

      run(function () {
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', id: '1',
          secretLab: env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA', id: '101' }),
          homePlanet: env.store.createRecord('home-planet', { name: 'Villain League', id: '123' })
        });
      });

      run(function () {
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(tom, 'firstName'),
        lastName: get(tom, 'lastName'),
        homePlanet: get(tom, 'homePlanet').get('id'),
        secretLab: {
          crazy_id: get(tom, 'secretLab').get('id'),
          minionCapacity: get(tom, 'secretLab').get('minionCapacity'),
          vicinity: get(tom, 'secretLab').get('vicinity')
        }
      });
    });

    test('serialize with embedded object (belongsTo relationship, new no id)', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('super-villain');

      // records without ids, new
      var tom, json;

      run(function () {
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale',
          secretLab: env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA' }),
          homePlanet: env.store.createRecord('home-planet', { name: 'Villain League', id: '123' })
        });
      });

      run(function () {
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(tom, 'firstName'),
        lastName: get(tom, 'lastName'),
        homePlanet: get(tom, 'homePlanet').get('id'),
        secretLab: {
          minionCapacity: get(tom, 'secretLab').get('minionCapacity'),
          vicinity: get(tom, 'secretLab').get('vicinity')
        }
      });
    });

    test('serialize with embedded object (belongsTo relationship) supports serialize:ids', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { serialize: 'ids' }
        }
      }));
      var serializer = env.store.serializerFor('super-villain');

      // records with an id, persisted
      var tom, json;

      run(function () {
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', id: '1',
          secretLab: env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA', id: '101' }),
          homePlanet: env.store.createRecord('home-planet', { name: 'Villain League', id: '123' })
        });
      });

      run(function () {
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(tom, 'firstName'),
        lastName: get(tom, 'lastName'),
        homePlanet: get(tom, 'homePlanet').get('id'),
        secretLab: get(tom, 'secretLab').get('id')
      });
    });

    test('serialize with embedded object (belongsTo relationship) supports serialize:id', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { serialize: 'id' }
        }
      }));

      var serializer = env.store.serializerFor('super-villain');

      // records with an id, persisted
      var tom, json;

      run(function () {
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', id: '1',
          secretLab: env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA', id: '101' }),
          homePlanet: env.store.createRecord('home-planet', { name: 'Villain League', id: '123' })
        });
      });

      run(function () {
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(tom, 'firstName'),
        lastName: get(tom, 'lastName'),
        homePlanet: get(tom, 'homePlanet').get('id'),
        secretLab: get(tom, 'secretLab').get('id')
      });
    });

    test('serialize with embedded object (belongsTo relationship) supports serialize:id in conjunction with deserialize:records', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { serialize: 'id', deserialize: 'records' }
        }
      }));

      var serializer = env.store.serializerFor('super-villain');

      // records with an id, persisted
      var tom, json;

      run(function () {
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', id: '1',
          secretLab: env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA', id: '101' }),
          homePlanet: env.store.createRecord('home-planet', { name: 'Villain League', id: '123' })
        });
      });

      run(function () {
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(tom, 'firstName'),
        lastName: get(tom, 'lastName'),
        homePlanet: get(tom, 'homePlanet').get('id'),
        secretLab: get(tom, 'secretLab').get('id')
      });
    });

    test('serialize with embedded object (belongsTo relationship) supports serialize:false', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { serialize: false }
        }
      }));
      var serializer = env.store.serializerFor('super-villain');

      // records with an id, persisted
      var tom, json;
      run(function () {
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', id: '1',
          secretLab: env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA', id: '101' }),
          homePlanet: env.store.createRecord('home-planet', { name: 'Villain League', id: '123' })
        });
      });

      run(function () {
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(tom, 'firstName'),
        lastName: get(tom, 'lastName'),
        homePlanet: get(tom, 'homePlanet').get('id')
      });
    });

    test('serialize with embedded object (belongsTo relationship) serializes the id by default if no option specified', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin));
      var serializer = env.store.serializerFor('super-villain');

      // records with an id, persisted

      var tom, json;

      run(function () {
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', id: '1',
          secretLab: env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA', id: '101' }),
          homePlanet: env.store.createRecord('home-planet', { name: 'Villain League', id: '123' })
        });
      });

      run(function () {
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(tom, 'firstName'),
        lastName: get(tom, 'lastName'),
        homePlanet: get(tom, 'homePlanet').get('id'),
        secretLab: get(tom, 'secretLab').get('id')
      });
    });

    test('when related record is not present, serialize embedded record (with a belongsTo relationship) as null', function () {
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { embedded: 'always' }
        }
      }));
      var serializer = env.store.serializerFor('super-villain');
      var tom, json;

      run(function () {
        tom = env.store.createRecord('super-villain', { firstName: 'Tom', lastName: 'Dale', id: '1',
          homePlanet: env.store.createRecord('home-planet', { name: 'Villain League', id: '123' })
        });
      });

      run(function () {
        json = serializer.serialize(tom._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(tom, 'firstName'),
        lastName: get(tom, 'lastName'),
        homePlanet: get(tom, 'homePlanet').get('id'),
        secretLab: null
      });
    });

    test('normalizeResponse with multiply-nested belongsTo', function () {
      env.registry.register('serializer:evil-minion', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          superVillain: { embedded: 'always' }
        }
      }));
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          homePlanet: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('evil-minion');
      var json_hash = {
        evilMinion: {
          id: '1',
          name: 'Alex',
          superVillain: {
            id: '1',
            firstName: 'Tom',
            lastName: 'Dale',
            evilMinions: ['1'],
            homePlanet: {
              id: '1',
              name: 'Umber',
              villains: ['1']
            }
          }
        }
      };
      var json;

      run(function () {
        json = serializer.normalizeResponse(env.store, EvilMinion, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'evil-minion',
          'attributes': {
            'name': 'Alex'
          },
          'relationships': {
            'superVillain': {
              'data': { 'id': '1', 'type': 'super-villain' }
            }
          }
        },
        'included': [{
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'relationships': {
            'evilMinions': {
              'data': [{ 'id': '1', 'type': 'evil-minion' }]
            },
            'homePlanet': {
              'data': { 'id': '1', 'type': 'home-planet' }
            }
          }
        }, {
          'id': '1',
          'type': 'home-planet',
          'attributes': {
            'name': 'Umber'
          },
          'relationships': {
            'villains': {
              'data': [{ 'id': '1', 'type': 'super-villain' }]
            }
          }
        }]
      }, 'Primary hash was correct');
    });

    test('normalizeResponse with polymorphic hasMany', function () {
      SuperVillain.reopen({
        secretWeapons: DS.hasMany('secretWeapon', { polymorphic: true, async: false })
      });

      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretWeapons: { embedded: 'always' }
        }
      }));
      var serializer = env.store.serializerFor('super-villain');

      var json_hash = {
        super_villain: {
          id: '1',
          firstName: 'Tom',
          lastName: 'Dale',
          secretWeapons: [{
            id: '1',
            type: 'LightSaber',
            name: 'Tom\'s LightSaber',
            color: 'Red'
          }, {
            id: '1',
            type: 'SecretWeapon',
            name: 'The Death Star'
          }]
        }
      };
      var json;

      run(function () {
        json = serializer.normalizeResponse(env.store, SuperVillain, json_hash, '1', 'findAll');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'relationships': {
            'secretWeapons': {
              'data': [{ 'id': '1', 'type': 'light-saber' }, { 'id': '1', 'type': 'secret-weapon' }]
            }
          }
        },
        'included': [{
          'id': '1',
          'type': 'light-saber',
          'attributes': {
            'color': 'Red',
            'name': 'Tom\'s LightSaber'
          },
          'relationships': {}
        }, {
          'id': '1',
          'type': 'secret-weapon',
          'attributes': {
            'name': 'The Death Star'
          },
          'relationships': {}
        }]
      }, 'Primary hash was correct');
    });

    test('normalizeResponse with polymorphic hasMany and custom primary key', function () {
      SuperVillain.reopen({
        secretWeapons: DS.hasMany('secretWeapon', { polymorphic: true, async: false })
      });

      env.registry.register('serializer:light-saber', DS.RESTSerializer.extend({
        primaryKey: 'custom'
      }));
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretWeapons: { embedded: 'always' }
        }
      }));
      var serializer = env.store.serializerFor('super-villain');

      var json_hash = {
        super_villain: {
          id: '1',
          firstName: 'Tom',
          lastName: 'Dale',
          secretWeapons: [{
            custom: '1',
            type: 'LightSaber',
            name: 'Tom\'s LightSaber',
            color: 'Red'
          }, {
            id: '1',
            type: 'SecretWeapon',
            name: 'The Death Star'
          }]
        }
      };
      var json;

      run(function () {
        json = serializer.normalizeResponse(env.store, SuperVillain, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'id': '1',
          'relationships': {
            'secretWeapons': {
              'data': [{ 'type': 'light-saber', 'id': '1' }, { 'type': 'secret-weapon', 'id': '1' }]
            }
          },
          'type': 'super-villain'
        },
        'included': [{
          'attributes': {
            'color': 'Red',
            'name': 'Tom\'s LightSaber'
          },
          'id': '1',
          'relationships': {},
          'type': 'light-saber'
        }, {
          'attributes': {
            'name': 'The Death Star'
          },
          'id': '1',
          'relationships': {},
          'type': 'secret-weapon'
        }]
      }, 'Custom primary key of embedded hasMany is correctly normalized');
    });

    test('normalizeResponse with polymorphic belongsTo', function () {
      SuperVillain.reopen({
        secretLab: DS.belongsTo('secretLab', { polymorphic: true, async: true })
      });

      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { embedded: 'always' }
        }
      }));
      var serializer = env.store.serializerFor('super-villain');

      var json_hash = {
        super_villain: {
          id: '1',
          firstName: 'Tom',
          lastName: 'Dale',
          secretLab: {
            id: '1',
            type: 'bat-cave',
            infiltrated: true
          }
        }
      };

      var json;

      run(function () {
        json = serializer.normalizeResponse(env.store, SuperVillain, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'relationships': {
            'secretLab': {
              'data': { 'id': '1', 'type': 'bat-cave' }
            }
          }
        },
        'included': [{
          'id': '1',
          'type': 'bat-cave',
          'attributes': {
            'infiltrated': true
          },
          'relationships': {}
        }]
      }, 'Primary has was correct');
    });

    test('normalizeResponse with polymorphic belongsTo and custom primary key', function () {
      expect(1);

      SuperVillain.reopen({
        secretLab: DS.belongsTo('secretLab', { polymorphic: true, async: true })
      });

      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretLab: { embedded: 'always' }
        }
      }));
      env.registry.register('serializer:bat-cave', DS.RESTSerializer.extend({
        primaryKey: 'custom'
      }));
      var serializer = env.store.serializerFor('super-villain');

      var json_hash = {
        superVillain: {
          id: '1',
          firstName: 'Tom',
          lastName: 'Dale',
          secretLab: {
            custom: '1',
            type: 'bat-cave',
            infiltrated: true
          }
        }
      };

      var json;

      run(function () {
        json = serializer.normalizeResponse(env.store, SuperVillain, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'id': '1',
          'relationships': {
            'secretLab': {
              'data': {
                'id': '1',
                'type': 'bat-cave'
              }
            }
          },
          'type': 'super-villain'
        },
        'included': [{
          'attributes': {
            'infiltrated': true
          },
          'id': '1',
          'relationships': {},
          'type': 'bat-cave'
        }]
      }, 'Custom primary key is correctly normalized');
    });

    test('Mixin can be used with RESTSerializer which does not define keyForAttribute', function () {
      run(function () {
        homePlanet = env.store.createRecord('home-planet', { name: 'Villain League', id: '123' });
        secretLab = env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA', id: '101' });
        superVillain = env.store.createRecord('super-villain', {
          id: '1', firstName: 'Super', lastName: 'Villian', homePlanet: homePlanet, secretLab: secretLab
        });
        secretWeapon = env.store.createRecord('secret-weapon', { id: '1', name: 'Secret Weapon', superVillain: superVillain });
        superVillain.get('secretWeapons').pushObject(secretWeapon);
        evilMinion = env.store.createRecord('evil-minion', { id: '1', name: 'Evil Minion', superVillian: superVillain });
        superVillain.get('evilMinions').pushObject(evilMinion);
      });

      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          evilMinions: { serialize: 'records', deserialize: 'records' }
        }
      }));
      var serializer = env.store.serializerFor('super-villain');
      var json;

      run(function () {
        json = serializer.serialize(superVillain._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(superVillain, 'firstName'),
        lastName: get(superVillain, 'lastName'),
        homePlanet: '123',
        evilMinions: [{
          id: get(evilMinion, 'id'),
          name: get(evilMinion, 'name'),
          superVillain: '1'
        }],
        secretLab: '101'
        // "manyToOne" relation does not serialize ids
        // sersecretWeapons: ["1"]
      });
    });

    test('normalize with custom belongsTo primary key', function () {
      env.registry.register('serializer:evil-minion', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          superVillain: { embedded: 'always' }
        }
      }));
      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend({
        primaryKey: 'custom'
      }));

      var serializer = env.store.serializerFor('evil-minion');
      var json_hash = {
        evilMinion: {
          id: '1',
          name: 'Alex',
          superVillain: {
            custom: '1',
            firstName: 'Tom',
            lastName: 'Dale'
          }
        }
      };
      var json;

      run(function () {
        json = serializer.normalizeResponse(env.store, EvilMinion, json_hash, '1', 'findRecord');
      });

      deepEqual(json, {
        'data': {
          'id': '1',
          'type': 'evil-minion',
          'attributes': {
            'name': 'Alex'
          },
          'relationships': {
            'superVillain': {
              'data': { 'id': '1', 'type': 'super-villain' }
            }
          }
        },
        'included': [{
          'id': '1',
          'type': 'super-villain',
          'attributes': {
            'firstName': 'Tom',
            'lastName': 'Dale'
          },
          'relationships': {}
        }]
      }, 'Primary hash was correct');
    });

    test('serializing relationships with an embedded and without calls super when not attr not present', function () {
      run(function () {
        homePlanet = env.store.createRecord('home-planet', { name: 'Villain League', id: '123' });
        secretLab = env.store.createRecord('secret-lab', { minionCapacity: 5000, vicinity: 'California, USA', id: '101' });
        superVillain = env.store.createRecord('super-villain', {
          id: '1', firstName: 'Super', lastName: 'Villian', homePlanet: homePlanet, secretLab: secretLab
        });
        secretWeapon = env.store.createRecord('secret-weapon', { id: '1', name: 'Secret Weapon', superVillain: superVillain });
        superVillain.get('secretWeapons').pushObject(secretWeapon);
        evilMinion = env.store.createRecord('evil-minion', { id: '1', name: 'Evil Minion', superVillian: superVillain });
        superVillain.get('evilMinions').pushObject(evilMinion);
      });

      var calledSerializeBelongsTo = false;
      var calledSerializeHasMany = false;

      var Serializer = DS.RESTSerializer.extend({
        serializeBelongsTo: function (snapshot, json, relationship) {
          calledSerializeBelongsTo = true;
          return this._super(snapshot, json, relationship);
        },
        serializeHasMany: function (snapshot, json, relationship) {
          calledSerializeHasMany = true;
          var key = relationship.key;
          var payloadKey = this.keyForRelationship ? this.keyForRelationship(key, 'hasMany') : key;
          var relationshipType = snapshot.type.determineRelationshipType(relationship);
          // "manyToOne" not supported in DS.ActiveModelSerializer.prototype.serializeHasMany
          var relationshipTypes = Ember.String.w('manyToNone manyToMany manyToOne');
          if (relationshipTypes.indexOf(relationshipType) > -1) {
            json[payloadKey] = snapshot.hasMany(key, { ids: true });
          }
        }
      });
      env.registry.register('serializer:evil-minion', Serializer);
      env.registry.register('serializer:secret-weapon', Serializer);
      env.registry.register('serializer:super-villain', Serializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          evilMinions: { serialize: 'records', deserialize: 'records' }
          // some relationships are not listed here, so super should be called on those
          // e.g. secretWeapons: { serialize: 'ids' }
        }
      }));
      var serializer = env.store.serializerFor('super-villain');

      var json;
      run(function () {
        json = serializer.serialize(superVillain._createSnapshot());
      });

      deepEqual(json, {
        firstName: get(superVillain, 'firstName'),
        lastName: get(superVillain, 'lastName'),
        homePlanet: '123',
        evilMinions: [{
          id: get(evilMinion, 'id'),
          name: get(evilMinion, 'name'),
          superVillain: '1'
        }],
        secretLab: '101',
        // customized serializeHasMany method to generate ids for "manyToOne" relation
        secretWeapons: ['1']
      });
      ok(calledSerializeBelongsTo);
      ok(calledSerializeHasMany);
    });

    test('serializing belongsTo correctly removes embedded foreign key', function () {
      SecretWeapon.reopen({
        superVillain: null
      });
      EvilMinion.reopen({
        secretWeapon: DS.belongsTo('secret-weapon', { async: false }),
        superVillain: null
      });

      run(function () {
        secretWeapon = env.store.createRecord('secret-weapon', { name: 'Secret Weapon' });
        evilMinion = env.store.createRecord('evil-minion', { name: 'Evil Minion', secretWeapon: secretWeapon });
      });

      env.registry.register('serializer:evil-minion', DS.RESTSerializer.extend(DS.EmbeddedRecordsMixin, {
        attrs: {
          secretWeapon: { embedded: 'always' }
        }
      }));

      var serializer = env.store.serializerFor('evil-minion');
      var json;

      run(function () {
        json = serializer.serialize(evilMinion._createSnapshot());
      });

      deepEqual(json, {
        name: 'Evil Minion',
        secretWeapon: {
          name: 'Secret Weapon'
        }
      });
    });
  }
);


define(
  "ember-data/tests/integration/serializers/json-api-serializer-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, serializer;

    var get = Ember.get;
    var run = Ember.run;

    var User, Handle, GithubHandle, TwitterHandle, Company;

    module('integration/serializers/json-api-serializer - JSONAPISerializer', {
      setup: function () {
        User = DS.Model.extend({
          firstName: DS.attr('string'),
          lastName: DS.attr('string'),
          handles: DS.hasMany('handle', { async: true, polymorphic: true }),
          company: DS.belongsTo('company', { async: true })
        });

        Handle = DS.Model.extend({
          user: DS.belongsTo('user', { async: true })
        });

        GithubHandle = Handle.extend({
          username: DS.attr('string')
        });

        TwitterHandle = Handle.extend({
          nickname: DS.attr('string')
        });

        Company = DS.Model.extend({
          name: DS.attr('string'),
          employees: DS.hasMany('user', { async: true })
        });

        env = setupStore({
          adapter: DS.JSONAPIAdapter,

          user: User,
          handle: Handle,
          'github-handle': GithubHandle,
          'twitter-handle': TwitterHandle,
          company: Company
        });

        store = env.store;
        serializer = store.serializerFor('-json-api');
      },

      teardown: function () {
        run(env.store, 'destroy');
      }
    });

    test('Calling pushPayload works', function () {
      run(function () {
        serializer.pushPayload(store, {
          data: {
            type: 'users',
            id: '1',
            attributes: {
              'first-name': 'Yehuda',
              'last-name': 'Katz'
            },
            relationships: {
              company: {
                data: { type: 'companies', id: '2' }
              },
              handles: {
                data: [{ type: 'github-handles', id: '3' }, { type: 'twitter-handles', id: '4' }]
              }
            }
          },
          included: [{
            type: 'companies',
            id: '2',
            attributes: {
              name: 'Tilde Inc.'
            }
          }, {
            type: 'github-handles',
            id: '3',
            attributes: {
              username: 'wycats'
            }
          }, {
            type: 'twitter-handles',
            id: '4',
            attributes: {
              nickname: '@wycats'
            }
          }]
        });

        var user = store.peekRecord('user', 1);

        equal(get(user, 'firstName'), 'Yehuda', 'firstName is correct');
        equal(get(user, 'lastName'), 'Katz', 'lastName is correct');
        equal(get(user, 'company.name'), 'Tilde Inc.', 'company.name is correct');
        equal(get(user, 'handles.firstObject.username'), 'wycats', 'handles.firstObject.username is correct');
        equal(get(user, 'handles.lastObject.nickname'), '@wycats', 'handles.lastObject.nickname is correct');
      });
    });
  }
);


define(
  "ember-data/tests/integration/serializers/json-serializer-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Post, post, Comment, comment, Favorite, favorite, env;
    var run = Ember.run;

    module('integration/serializer/json - JSONSerializer', {
      setup: function () {
        Post = DS.Model.extend({
          title: DS.attr('string'),
          comments: DS.hasMany('comment', { inverse: null, async: false })
        });
        Comment = DS.Model.extend({
          body: DS.attr('string'),
          post: DS.belongsTo('post', { async: false })
        });
        Favorite = DS.Model.extend({
          post: DS.belongsTo('post', { async: true, polymorphic: true })
        });
        env = setupStore({
          post: Post,
          comment: Comment,
          favorite: Favorite
        });
        env.store.modelFor('post');
        env.store.modelFor('comment');
        env.store.modelFor('favorite');
      },

      teardown: function () {
        run(env.store, 'destroy');
      }
    });

    test('serializeAttribute', function () {
      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
      });
      var json = {};

      env.serializer.serializeAttribute(post._createSnapshot(), json, 'title', { type: 'string' });

      deepEqual(json, {
        title: 'Rails is omakase'
      });
    });

    test('serializeAttribute respects keyForAttribute', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        keyForAttribute: function (key) {
          return key.toUpperCase();
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
      });
      var json = {};

      env.store.serializerFor('post').serializeAttribute(post._createSnapshot(), json, 'title', { type: 'string' });

      deepEqual(json, { TITLE: 'Rails is omakase' });
    });

    test('serializeBelongsTo', function () {
      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase', id: '1' });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });

      var json = {};

      env.serializer.serializeBelongsTo(comment._createSnapshot(), json, { key: 'post', options: {} });

      deepEqual(json, { post: '1' });
    });

    test('serializeBelongsTo with null', function () {
      run(function () {
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: null });
      });
      var json = {};

      env.serializer.serializeBelongsTo(comment._createSnapshot(), json, { key: 'post', options: {} });

      deepEqual(json, {
        post: null
      }, 'Can set a belongsTo to a null value');
    });

    test('async serializeBelongsTo with null', function () {
      Comment.reopen({
        post: DS.belongsTo('post', { async: true })
      });
      run(function () {
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: null });
      });
      var json = {};

      env.serializer.serializeBelongsTo(comment._createSnapshot(), json, { key: 'post', options: {} });

      deepEqual(json, {
        post: null
      }, 'Can set a belongsTo to a null value');
    });

    test('serializeBelongsTo respects keyForRelationship', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        keyForRelationship: function (key, type) {
          return key.toUpperCase();
        }
      }));
      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase', id: '1' });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });
      var json = {};

      env.store.serializerFor('post').serializeBelongsTo(comment._createSnapshot(), json, { key: 'post', options: {} });

      deepEqual(json, {
        POST: '1'
      });
    });

    test('serializeHasMany respects keyForRelationship', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        keyForRelationship: function (key, type) {
          return key.toUpperCase();
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase', id: '1' });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post, id: '1' });
      });

      var json = {};

      env.store.serializerFor('post').serializeHasMany(post._createSnapshot(), json, { key: 'comments', options: {} });

      deepEqual(json, {
        COMMENTS: ['1']
      });
    });

    test('serializeIntoHash', function () {
      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
      });

      var json = {};

      env.serializer.serializeIntoHash(json, Post, post._createSnapshot());

      deepEqual(json, {
        title: 'Rails is omakase',
        comments: []
      });
    });

    test('serializePolymorphicType sync', function () {
      expect(1);

      env.registry.register('serializer:comment', DS.JSONSerializer.extend({
        serializePolymorphicType: function (record, json, relationship) {
          var key = relationship.key;
          var belongsTo = record.belongsTo(key);
          json[relationship.key + 'TYPE'] = belongsTo.modelName;

          ok(true, 'serializePolymorphicType is called when serialize a polymorphic belongsTo');
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase', id: 1 });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });

      env.store.serializerFor('comment').serializeBelongsTo(comment._createSnapshot(), {}, { key: 'post', options: { polymorphic: true } });
    });

    test('serializePolymorphicType async', function () {
      expect(1);

      Comment.reopen({
        post: DS.belongsTo('post', { async: true })
      });

      env.registry.register('serializer:comment', DS.JSONSerializer.extend({
        serializePolymorphicType: function (record, json, relationship) {
          ok(true, 'serializePolymorphicType is called when serialize a polymorphic belongsTo');
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase', id: 1 });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });

      env.store.serializerFor('comment').serializeBelongsTo(comment._createSnapshot(), {}, { key: 'post', options: { async: true, polymorphic: true } });
    });

    test('normalizeResponse normalizes each record in the array', function () {
      var postNormalizeCount = 0;
      var posts = [{ id: '1', title: 'Rails is omakase' }, { id: '2', title: 'Another Post' }];

      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        normalize: function () {
          postNormalizeCount++;
          return this._super.apply(this, arguments);
        }
      }));

      run(function () {
        env.store.serializerFor('post').normalizeResponse(env.store, Post, posts, null, 'findAll');
      });
      equal(postNormalizeCount, 2, 'two posts are normalized');
    });

    test('Serializer should respect the attrs hash when extracting records', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        attrs: {
          title: 'title_payload_key',
          comments: { key: 'my_comments' }
        }
      }));

      var jsonHash = {
        id: '1',
        title_payload_key: 'Rails is omakase',
        my_comments: [1, 2]
      };

      var post = env.store.serializerFor('post').normalizeResponse(env.store, Post, jsonHash, '1', 'findRecord');

      equal(post.data.attributes.title, 'Rails is omakase');
      deepEqual(post.data.relationships.comments.data, [{ id: '1', type: 'comment' }, { id: '2', type: 'comment' }]);
    });

    test('Serializer should respect the attrs hash when serializing records', function () {
      Post.reopen({
        parentPost: DS.belongsTo('post', { inverse: null, async: true })
      });
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        attrs: {
          title: 'title_payload_key',
          parentPost: { key: 'my_parent' }
        }
      }));
      var parentPost;

      run(function () {
        parentPost = env.store.push('post', { id: 2, title: 'Rails is omakase' });
        post = env.store.createRecord('post', { title: 'Rails is omakase', parentPost: parentPost });
      });

      var payload = env.store.serializerFor('post').serialize(post._createSnapshot());

      equal(payload.title_payload_key, 'Rails is omakase');
      equal(payload.my_parent, '2');
    });

    test('Serializer respects `serialize: false` on the attrs hash', function () {
      expect(2);
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        attrs: {
          title: { serialize: false }
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
      });

      var payload = env.store.serializerFor('post').serialize(post._createSnapshot());

      ok(!payload.hasOwnProperty('title'), 'Does not add the key to instance');
      ok(!payload.hasOwnProperty('[object Object]'), 'Does not add some random key like [object Object]');
    });

    test('Serializer respects `serialize: false` on the attrs hash for a `hasMany` property', function () {
      expect(1);
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        attrs: {
          comments: { serialize: false }
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });

      var serializer = env.store.serializerFor('post');
      var serializedProperty = serializer.keyForRelationship('comments', 'hasMany');

      var payload = serializer.serialize(post._createSnapshot());
      ok(!payload.hasOwnProperty(serializedProperty), 'Does not add the key to instance');
    });

    test('Serializer respects `serialize: false` on the attrs hash for a `belongsTo` property', function () {
      expect(1);
      env.registry.register('serializer:comment', DS.JSONSerializer.extend({
        attrs: {
          post: { serialize: false }
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });

      var serializer = env.store.serializerFor('comment');
      var serializedProperty = serializer.keyForRelationship('post', 'belongsTo');

      var payload = serializer.serialize(comment._createSnapshot());
      ok(!payload.hasOwnProperty(serializedProperty), 'Does not add the key to instance');
    });

    test('Serializer respects `serialize: false` on the attrs hash for a `hasMany` property', function () {
      expect(1);
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        attrs: {
          comments: { serialize: false }
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });

      var serializer = env.store.serializerFor('post');
      var serializedProperty = serializer.keyForRelationship('comments', 'hasMany');

      var payload = serializer.serialize(post._createSnapshot());
      ok(!payload.hasOwnProperty(serializedProperty), 'Does not add the key to instance');
    });

    test('Serializer respects `serialize: false` on the attrs hash for a `belongsTo` property', function () {
      expect(1);
      env.registry.register('serializer:comment', DS.JSONSerializer.extend({
        attrs: {
          post: { serialize: false }
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });

      var serializer = env.store.serializerFor('comment');
      var serializedProperty = serializer.keyForRelationship('post', 'belongsTo');

      var payload = serializer.serialize(comment._createSnapshot());
      ok(!payload.hasOwnProperty(serializedProperty), 'Does not add the key to instance');
    });

    test('Serializer respects `serialize: true` on the attrs hash for a `hasMany` property', function () {
      expect(1);
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        attrs: {
          comments: { serialize: true }
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });

      var serializer = env.store.serializerFor('post');
      var serializedProperty = serializer.keyForRelationship('comments', 'hasMany');

      var payload = serializer.serialize(post._createSnapshot());
      ok(payload.hasOwnProperty(serializedProperty), 'Add the key to instance');
    });

    test('Serializer respects `serialize: true` on the attrs hash for a `belongsTo` property', function () {
      expect(1);
      env.registry.register('serializer:comment', DS.JSONSerializer.extend({
        attrs: {
          post: { serialize: true }
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase' });
        comment = env.store.createRecord('comment', { body: 'Omakase is delicious', post: post });
      });

      var serializer = env.store.serializerFor('comment');
      var serializedProperty = serializer.keyForRelationship('post', 'belongsTo');

      var payload = serializer.serialize(comment._createSnapshot());
      ok(payload.hasOwnProperty(serializedProperty), 'Add the key to instance');
    });

    test('Serializer should merge attrs from superclasses', function () {
      expect(4);
      Post.reopen({
        description: DS.attr('string'),
        anotherString: DS.attr('string')
      });
      var BaseSerializer = DS.JSONSerializer.extend({
        attrs: {
          title: 'title_payload_key',
          anotherString: 'base_another_string_key'
        }
      });
      env.registry.register('serializer:post', BaseSerializer.extend({
        attrs: {
          description: 'description_payload_key',
          anotherString: 'overwritten_another_string_key'
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Rails is omakase', description: 'Omakase is delicious', anotherString: 'yet another string' });
      });

      var payload = env.store.serializerFor('post').serialize(post._createSnapshot());

      equal(payload.title_payload_key, 'Rails is omakase');
      equal(payload.description_payload_key, 'Omakase is delicious');
      equal(payload.overwritten_another_string_key, 'yet another string');
      ok(!payload.base_another_string_key, 'overwritten key is not added');
    });

    test('Serializer should respect the primaryKey attribute when extracting records', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        primaryKey: '_ID_'
      }));

      var jsonHash = { '_ID_': 1, title: 'Rails is omakase' };

      run(function () {
        post = env.store.serializerFor('post').normalizeResponse(env.store, Post, jsonHash, '1', 'findRecord');
      });

      equal(post.data.id, '1');
      equal(post.data.attributes.title, 'Rails is omakase');
    });

    test('Serializer should respect the primaryKey attribute when serializing records', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        primaryKey: '_ID_'
      }));

      run(function () {
        post = env.store.createRecord('post', { id: '1', title: 'Rails is omakase' });
      });

      var payload = env.store.serializerFor('post').serialize(post._createSnapshot(), { includeId: true });

      equal(payload._ID_, '1');
    });

    test('Serializer should respect keyForAttribute when extracting records', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        keyForAttribute: function (key) {
          return key.toUpperCase();
        }
      }));

      var jsonHash = { id: 1, TITLE: 'Rails is omakase' };

      post = env.store.serializerFor('post').normalize(Post, jsonHash);

      equal(post.data.id, '1');
      equal(post.data.attributes.title, 'Rails is omakase');
    });

    test('Serializer should respect keyForRelationship when extracting records', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        keyForRelationship: function (key, type) {
          return key.toUpperCase();
        }
      }));

      var jsonHash = { id: 1, title: 'Rails is omakase', COMMENTS: ['1'] };

      post = env.store.serializerFor('post').normalize(Post, jsonHash);

      deepEqual(post.data.relationships.comments.data, [{ id: '1', type: 'comment' }]);
    });

    test('Calling normalize should normalize the payload (only the passed keys)', function () {
      expect(1);
      var Person = DS.Model.extend({
        posts: DS.hasMany('post', { async: false })
      });
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        attrs: {
          notInHash: 'aCustomAttrNotInHash',
          inHash: 'aCustomAttrInHash'
        }
      }));

      env.registry.register('model:person', Person);

      Post.reopen({
        content: DS.attr('string'),
        author: DS.belongsTo('person', { async: false }),
        notInHash: DS.attr('string'),
        inHash: DS.attr('string')
      });

      var normalizedPayload = env.store.serializerFor('post').normalize(Post, {
        id: '1',
        title: 'Ember rocks',
        author: 1,
        aCustomAttrInHash: 'blah'
      });

      deepEqual(normalizedPayload, {
        'data': {
          'id': '1',
          'type': 'post',
          'attributes': {
            'inHash': 'blah',
            'title': 'Ember rocks'
          },
          'relationships': {
            'author': {
              'data': { 'id': '1', 'type': 'person' }
            }
          }
        }
      });
    });

    test('serializeBelongsTo with async polymorphic', function () {
      var json = {};
      var expected = { post: '1', postTYPE: 'post' };

      env.registry.register('serializer:favorite', DS.JSONSerializer.extend({
        serializePolymorphicType: function (snapshot, json, relationship) {
          var key = relationship.key;
          json[key + 'TYPE'] = snapshot.belongsTo(key).modelName;
        }
      }));

      run(function () {
        post = env.store.createRecord('post', { title: 'Kitties are omakase', id: '1' });
        favorite = env.store.createRecord('favorite', { post: post, id: '3' });
      });

      env.store.serializerFor('favorite').serializeBelongsTo(favorite._createSnapshot(), json, { key: 'post', options: { polymorphic: true, async: true } });

      deepEqual(json, expected, 'returned JSON is correct');
    });

    test('extractErrors respects custom key mappings', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        attrs: {
          title: 'le_title',
          comments: { key: 'my_comments' }
        }
      }));

      var payload = {
        errors: [{
          source: { pointer: 'data/attributes/le_title' },
          detail: 'title errors'
        }, {
          source: { pointer: 'data/attributes/my_comments' },
          detail: 'comments errors'
        }]
      };

      var errors = env.store.serializerFor('post').extractErrors(env.store, Post, payload);

      deepEqual(errors, {
        title: ['title errors'],
        comments: ['comments errors']
      });
    });

    test('extractErrors expects error information located on the errors property of payload', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend());

      var payload = {
        attributeWhichWillBeRemovedinExtractErrors: ['true'],
        errors: [{
          source: { pointer: 'data/attributes/title' },
          detail: 'title errors'
        }]
      };

      var errors = env.store.serializerFor('post').extractErrors(env.store, Post, payload);

      deepEqual(errors, { title: ['title errors'] });
    });

    test('extractErrors leaves payload untouched if it has no errors property', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend());

      var payload = {
        untouchedSinceNoErrorsSiblingPresent: ['true']
      };

      var errors = env.store.serializerFor('post').extractErrors(env.store, Post, payload);

      deepEqual(errors, { untouchedSinceNoErrorsSiblingPresent: ['true'] });
    });

    test('normalizeResponse should extract meta using extractMeta', function () {
      env.registry.register('serializer:post', DS.JSONSerializer.extend({
        extractMeta: function (store, modelClass, payload) {
          var meta = this._super.apply(this, arguments);
          meta.authors.push('Tomhuda');
          return meta;
        }
      }));

      var jsonHash = {
        id: '1',
        title_payload_key: 'Rails is omakase',
        my_comments: [1, 2],
        meta: {
          authors: ['Tomster']
        }
      };

      var post = env.store.serializerFor('post').normalizeResponse(env.store, Post, jsonHash, '1', 'findRecord');

      deepEqual(post.meta.authors, ['Tomster', 'Tomhuda']);
    });
  }
);


define(
  "ember-data/tests/integration/serializers/rest-serializer-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var HomePlanet, league, SuperVillain, EvilMinion, YellowMinion, DoomsdayDevice, Comment, env;
    var run = Ember.run;

    module('integration/serializer/rest - RESTSerializer', {
      setup: function () {
        HomePlanet = DS.Model.extend({
          name: DS.attr('string'),
          superVillains: DS.hasMany('super-villain', { async: false })
        });
        SuperVillain = DS.Model.extend({
          firstName: DS.attr('string'),
          lastName: DS.attr('string'),
          homePlanet: DS.belongsTo('home-planet', { async: false }),
          evilMinions: DS.hasMany('evil-minion', { async: false })
        });
        EvilMinion = DS.Model.extend({
          superVillain: DS.belongsTo('super-villain', { async: false }),
          name: DS.attr('string')
        });
        YellowMinion = EvilMinion.extend();
        DoomsdayDevice = DS.Model.extend({
          name: DS.attr('string'),
          evilMinion: DS.belongsTo('evil-minion', { polymorphic: true, async: true })
        });
        Comment = DS.Model.extend({
          body: DS.attr('string'),
          root: DS.attr('boolean'),
          children: DS.hasMany('comment', { inverse: null, async: false })
        });
        env = setupStore({
          superVillain: SuperVillain,
          homePlanet: HomePlanet,
          evilMinion: EvilMinion,
          yellowMinion: YellowMinion,
          doomsdayDevice: DoomsdayDevice,
          comment: Comment
        });
        env.store.modelFor('super-villain');
        env.store.modelFor('home-planet');
        env.store.modelFor('evil-minion');
        env.store.modelFor('yellow-minion');
        env.store.modelFor('doomsday-device');
        env.store.modelFor('comment');
      },

      teardown: function () {
        run(env.store, 'destroy');
      }
    });

    test('modelNameFromPayloadKey returns always same modelName even for uncountable multi words keys', function () {
      expect(2);
      Ember.Inflector.inflector.uncountable('words');
      var expectedModelName = 'multi-words';
      equal(env.restSerializer.modelNameFromPayloadKey('multi_words'), expectedModelName);
      equal(env.restSerializer.modelNameFromPayloadKey('multi-words'), expectedModelName);
    });

    test('normalizeResponse should extract meta using extractMeta', function () {
      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend({
        extractMeta: function (store, modelClass, payload) {
          var meta = this._super.apply(this, arguments);
          meta.authors.push('Tomhuda');
          return meta;
        }
      }));

      var jsonHash = {
        meta: { authors: ['Tomster'] },
        home_planets: [{ id: '1', name: 'Umber', superVillains: [1] }]
      };

      var json = env.container.lookup('serializer:home-planet').normalizeResponse(env.store, HomePlanet, jsonHash, null, 'findAll');

      deepEqual(json.meta.authors, ['Tomster', 'Tomhuda']);
    });

    test('normalizeResponse with custom modelNameFromPayloadKey', function () {
      expect(1);

      env.restSerializer.modelNameFromPayloadKey = function (root) {
        var camelized = Ember.String.camelize(root);
        return Ember.String.singularize(camelized);
      };

      var jsonHash = {
        home_planets: [{ id: '1', name: 'Umber', superVillains: [1] }],
        super_villains: [{ id: '1', firstName: 'Tom', lastName: 'Dale', homePlanet: '1' }]
      };
      var array;

      run(function () {
        array = env.restSerializer.normalizeResponse(env.store, HomePlanet, jsonHash, '1', 'findRecord');
      });

      deepEqual(array, {
        data: {
          id: '1',
          type: 'home-planet',
          attributes: {
            name: 'Umber'
          },
          relationships: {
            superVillains: {
              data: [{ id: '1', type: 'super-villain' }]
            }
          }
        },
        included: [{
          id: '1',
          type: 'super-villain',
          attributes: {
            firstName: 'Tom',
            lastName: 'Dale'
          },
          relationships: {
            homePlanet: {
              data: { id: '1', type: 'home-planet' }
            }
          }
        }]
      });
    });

    test('normalizeResponse warning with custom modelNameFromPayloadKey', function () {
      var homePlanet;
      var oldModelNameFromPayloadKey = env.restSerializer.modelNameFromPayloadKey;
      env.restSerializer.modelNameFromPayloadKey = function (root) {
        //return some garbage that won"t resolve in the container
        return 'garbage';
      };

      var jsonHash = {
        home_planet: { id: '1', name: 'Umber', superVillains: [1] }
      };

      warns(Ember.run.bind(null, function () {
        run(function () {
          env.restSerializer.normalizeResponse(env.store, HomePlanet, jsonHash, '1', 'findRecord');
        });
      }), /Encountered "home_planet" in payload, but no model was found for model name "garbage"/);

      // should not warn if a model is found.
      env.restSerializer.modelNameFromPayloadKey = oldModelNameFromPayloadKey;
      jsonHash = {
        home_planet: { id: '1', name: 'Umber', superVillains: [1] }
      };

      noWarns(function () {
        run(function () {

          homePlanet = env.restSerializer.normalizeResponse(env.store, HomePlanet, jsonHash, 1, 'findRecord');
        });
      });

      equal(homePlanet.data.attributes.name, 'Umber');
      deepEqual(homePlanet.data.relationships.superVillains.data, [{ id: '1', type: 'super-villain' }]);
    });

    test('normalizeResponse warning with custom modelNameFromPayloadKey', function () {
      var homePlanets;
      env.restSerializer.modelNameFromPayloadKey = function (root) {
        //return some garbage that won"t resolve in the container
        return 'garbage';
      };

      var jsonHash = {
        home_planets: [{ id: '1', name: 'Umber', superVillains: [1] }]
      };

      warns(function () {
        env.restSerializer.normalizeResponse(env.store, HomePlanet, jsonHash, null, 'findAll');
      }, /Encountered "home_planets" in payload, but no model was found for model name "garbage"/);

      // should not warn if a model is found.
      env.restSerializer.modelNameFromPayloadKey = function (root) {
        return Ember.String.camelize(Ember.String.singularize(root));
      };

      jsonHash = {
        home_planets: [{ id: '1', name: 'Umber', superVillains: [1] }]
      };

      noWarns(function () {
        run(function () {
          homePlanets = env.restSerializer.normalizeResponse(env.store, HomePlanet, jsonHash, null, 'findAll');
        });
      });

      equal(homePlanets.data.length, 1);
      equal(homePlanets.data[0].attributes.name, 'Umber');
      deepEqual(homePlanets.data[0].relationships.superVillains.data, [{ id: '1', type: 'super-villain' }]);
    });

    test('serialize polymorphicType', function () {
      var tom, ray;
      run(function () {
        tom = env.store.createRecord('yellow-minion', { name: 'Alex', id: '124' });
        ray = env.store.createRecord('doomsday-device', { evilMinion: tom, name: 'DeathRay' });
      });

      var json = env.restSerializer.serialize(ray._createSnapshot());

      deepEqual(json, {
        name: 'DeathRay',
        evilMinionType: 'yellowMinion',
        evilMinion: '124'
      });
    });

    test('serialize polymorphicType with decamelized modelName', function () {
      YellowMinion.modelName = 'yellow-minion';
      var tom, ray;
      run(function () {
        tom = env.store.createRecord('yellow-minion', { name: 'Alex', id: '124' });
        ray = env.store.createRecord('doomsday-device', { evilMinion: tom, name: 'DeathRay' });
      });

      var json = env.restSerializer.serialize(ray._createSnapshot());

      deepEqual(json['evilMinionType'], 'yellowMinion');
    });

    test('serialize polymorphic when associated object is null', function () {
      var ray;
      run(function () {
        ray = env.store.createRecord('doomsday-device', { name: 'DeathRay' });
      });

      var json = env.restSerializer.serialize(ray._createSnapshot());

      deepEqual(json['evilMinionType'], null);
    });

    test('normalizeResponse loads secondary records with correct serializer', function () {
      var superVillainNormalizeCount = 0;

      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend({
        normalize: function () {
          superVillainNormalizeCount++;
          return this._super.apply(this, arguments);
        }
      }));

      var jsonHash = {
        evilMinion: { id: '1', name: 'Tom Dale', superVillain: 1 },
        superVillains: [{ id: '1', firstName: 'Yehuda', lastName: 'Katz', homePlanet: '1' }]
      };

      run(function () {
        env.restSerializer.normalizeResponse(env.store, EvilMinion, jsonHash, '1', 'findRecord');
      });

      equal(superVillainNormalizeCount, 1, 'superVillain is normalized once');
    });

    test('normalizeResponse returns null if payload contains null', function () {
      expect(1);

      var jsonHash = {
        evilMinion: null
      };
      var value;

      run(function () {
        value = env.restSerializer.normalizeResponse(env.store, EvilMinion, jsonHash, null, 'findRecord');
      });

      deepEqual(value, { data: null, included: [] }, 'returned value is null');
    });

    test('normalizeResponse loads secondary records with correct serializer', function () {
      var superVillainNormalizeCount = 0;

      env.registry.register('serializer:super-villain', DS.RESTSerializer.extend({
        normalize: function () {
          superVillainNormalizeCount++;
          return this._super.apply(this, arguments);
        }
      }));

      var jsonHash = {
        evilMinions: [{ id: '1', name: 'Tom Dale', superVillain: 1 }],
        superVillains: [{ id: '1', firstName: 'Yehuda', lastName: 'Katz', homePlanet: '1' }]
      };

      run(function () {
        env.restSerializer.normalizeResponse(env.store, EvilMinion, jsonHash, null, 'findAll');
      });

      equal(superVillainNormalizeCount, 1, 'superVillain is normalized once');
    });

    test('normalizeHash normalizes specific parts of the payload', function () {
      env.registry.register('serializer:application', DS.RESTSerializer.extend({
        normalizeHash: {
          homePlanets: function (hash) {
            hash.id = hash._id;
            delete hash._id;
            return hash;
          }
        }
      }));

      var jsonHash = {
        homePlanets: [{ _id: '1', name: 'Umber', superVillains: [1] }]
      };
      var array;

      run(function () {
        array = env.restSerializer.normalizeResponse(env.store, HomePlanet, jsonHash, null, 'findAll');
      });

      deepEqual(array, {
        'data': [{
          'id': '1',
          'type': 'home-planet',
          'attributes': {
            'name': 'Umber'
          },
          'relationships': {
            'superVillains': {
              'data': [{ 'id': '1', 'type': 'super-villain' }]
            }
          }
        }],
        'included': []
      });
    });

    test('normalizeHash works with transforms', function () {
      env.registry.register('serializer:application', DS.RESTSerializer.extend({
        normalizeHash: {
          evilMinions: function (hash) {
            hash.condition = hash._condition;
            delete hash._condition;
            return hash;
          }
        }
      }));

      env.registry.register('transform:condition', DS.Transform.extend({
        deserialize: function (serialized) {
          if (serialized === 1) {
            return 'healing';
          } else {
            return 'unknown';
          }
        },
        serialize: function (deserialized) {
          if (deserialized === 'healing') {
            return 1;
          } else {
            return 2;
          }
        }
      }));

      EvilMinion.reopen({ condition: DS.attr('condition') });

      var jsonHash = {
        evilMinions: [{ id: '1', name: 'Tom Dale', superVillain: 1, _condition: 1 }]
      };
      var array;

      run(function () {
        array = env.restSerializer.normalizeResponse(env.store, EvilMinion, jsonHash, null, 'findAll');
      });

      equal(array.data[0].attributes.condition, 'healing');
    });

    test('normalize should allow for different levels of normalization', function () {
      env.registry.register('serializer:application', DS.RESTSerializer.extend({
        attrs: {
          superVillain: 'is_super_villain'
        },
        keyForAttribute: function (attr) {
          return Ember.String.decamelize(attr);
        }
      }));

      var jsonHash = {
        evilMinions: [{ id: '1', name: 'Tom Dale', is_super_villain: 1 }]
      };
      var array;

      run(function () {
        array = env.restSerializer.normalizeResponse(env.store, EvilMinion, jsonHash, null, 'findAll');
      });

      equal(array.data[0].relationships.superVillain.data.id, 1);
    });

    test('serializeIntoHash', function () {
      run(function () {
        league = env.store.createRecord('home-planet', { name: 'Umber', id: '123' });
      });
      var json = {};

      env.restSerializer.serializeIntoHash(json, HomePlanet, league._createSnapshot());

      deepEqual(json, {
        homePlanet: {
          name: 'Umber'
        }
      });
    });

    test('serializeIntoHash with decamelized modelName', function () {
      HomePlanet.modelName = 'home-planet';
      run(function () {
        league = env.store.createRecord('home-planet', { name: 'Umber', id: '123' });
      });
      var json = {};

      env.restSerializer.serializeIntoHash(json, HomePlanet, league._createSnapshot());

      deepEqual(json, {
        homePlanet: {
          name: 'Umber'
        }
      });
    });

    test('serializeBelongsTo with async polymorphic', function () {
      var evilMinion, doomsdayDevice;
      var json = {};
      var expected = { evilMinion: '1', evilMinionType: 'evilMinion' };

      run(function () {
        evilMinion = env.store.createRecord('evil-minion', { id: 1, name: 'Tomster' });
        doomsdayDevice = env.store.createRecord('doomsday-device', { id: 2, name: 'Yehuda', evilMinion: evilMinion });
      });

      env.restSerializer.serializeBelongsTo(doomsdayDevice._createSnapshot(), json, { key: 'evilMinion', options: { polymorphic: true, async: true } });

      deepEqual(json, expected, 'returned JSON is correct');
    });

    test('serializeIntoHash uses payloadKeyFromModelName to normalize the payload root key', function () {
      run(function () {
        league = env.store.createRecord('home-planet', { name: 'Umber', id: '123' });
      });
      var json = {};
      env.registry.register('serializer:home-planet', DS.RESTSerializer.extend({
        payloadKeyFromModelName: function (modelName) {
          return Ember.String.dasherize(modelName);
        }
      }));

      env.container.lookup('serializer:home-planet').serializeIntoHash(json, HomePlanet, league._createSnapshot());

      deepEqual(json, {
        'home-planet': {
          name: 'Umber'
        }
      });
    });

    test('normalizeResponse can load secondary records of the same type without affecting the query count', function () {
      var jsonHash = {
        comments: [{ id: '1', body: 'Parent Comment', root: true, children: [2, 3] }],
        _comments: [{ id: '2', body: 'Child Comment 1', root: false }, { id: '3', body: 'Child Comment 2', root: false }]
      };
      var array;

      run(function () {
        array = env.restSerializer.normalizeResponse(env.store, Comment, jsonHash, '1', 'findRecord');
      });

      deepEqual(array, {
        'data': {
          'id': '1',
          'type': 'comment',
          'attributes': {
            'body': 'Parent Comment',
            'root': true
          },
          'relationships': {
            'children': {
              'data': [{ 'id': '2', 'type': 'comment' }, { 'id': '3', 'type': 'comment' }]
            }
          }
        },
        'included': [{
          'id': '2',
          'type': 'comment',
          'attributes': {
            'body': 'Child Comment 1',
            'root': false
          },
          'relationships': {}
        }, {
          'id': '3',
          'type': 'comment',
          'attributes': {
            'body': 'Child Comment 2',
            'root': false
          },
          'relationships': {}
        }]
      });
    });
  }
);


define(
  "ember-data/tests/integration/setup-container-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var run = Ember.run;
    var Container = Ember.Container;
    var Registry = Ember.Registry;
    var Store = DS.Store;
    var EmberObject = Ember.Object;
    var setupContainer = DS._setupContainer;

    var container, registry;

    /*
      These tests ensure that Ember Data works with Ember.js' container
      initialization and dependency injection API.
    */

    module("integration/setup-container - Setting up a container", {
      setup: function () {
        if (Registry) {
          registry = new Registry();
          container = registry.container();
        } else {
          container = new Container();
          registry = container;
        }
        setupContainer(registry);
      },

      teardown: function () {
        run(container, container.destroy);
      }
    });

    test("The store should be registered into a container.", function () {
      ok(container.lookup("service:store") instanceof Store, "the custom store is instantiated");
    });

    test("The store should be registered into the container as a service.", function () {
      ok(container.lookup("service:store") instanceof Store, "the store as a service is registered");
    });

    test("If a store is instantiated, it should be made available to each controller.", function () {
      registry.register("controller:foo", EmberObject.extend({}));
      var fooController = container.lookup("controller:foo");
      ok(fooController.get("store") instanceof Store, "the store was injected");
    });

    test("serializers are not returned as singletons - each lookup should return a different instance", function () {
      var serializer1, serializer2;
      serializer1 = container.lookup("serializer:-rest");
      serializer2 = container.lookup("serializer:-rest");
      notEqual(serializer1, serializer2);
    });

    test("adapters are not returned as singletons - each lookup should return a different instance", function () {
      var adapter1, adapter2;
      adapter1 = container.lookup("adapter:-rest");
      adapter2 = container.lookup("adapter:-rest");
      notEqual(adapter1, adapter2);
    });
  }
);


define(
  "ember-data/tests/integration/snapshot-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var run = Ember.run;
    var env, Post, Comment;

    module("integration/snapshot - DS.Snapshot", {
      setup: function () {
        Post = DS.Model.extend({
          author: DS.attr(),
          title: DS.attr(),
          comments: DS.hasMany({ async: true })
        });
        Comment = DS.Model.extend({
          body: DS.attr(),
          post: DS.belongsTo({ async: true })
        });

        env = setupStore({
          post: Post,
          comment: Comment
        });
      },

      teardown: function () {
        run(function () {
          env.store.destroy();
        });
      }
    });

    test("record._createSnapshot() returns a snapshot", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();

        ok(snapshot instanceof DS.Snapshot, "snapshot is an instance of DS.Snapshot");
      });
    });

    test("snapshot.id, snapshot.type and snapshot.modelName returns correctly", function () {
      expect(3);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();

        equal(snapshot.id, "1", "id is correct");
        ok(DS.Model.detect(snapshot.type), "type is correct");
        equal(snapshot.modelName, "post", "modelName is correct");
      });
    });

    test("snapshot.attr() does not change when record changes", function () {
      expect(2);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();

        equal(snapshot.attr("title"), "Hello World", "snapshot title is correct");
        post.set("title", "Tomster");
        equal(snapshot.attr("title"), "Hello World", "snapshot title is still correct");
      });
    });

    test("snapshot.attr() throws an error attribute not found", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();

        throws(function () {
          snapshot.attr("unknown");
        }, /has no attribute named 'unknown' defined/, "attr throws error");
      });
    });

    test("snapshot.attributes() returns a copy of all attributes for the current snapshot", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();

        var attributes = snapshot.attributes();

        deepEqual(attributes, { author: undefined, title: "Hello World" }, "attributes are returned correctly");
      });
    });

    test("snapshot.changedAttributes() returns a copy of all changed attributes for the current snapshot", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        post.set("title", "Hello World!");
        var snapshot = post._createSnapshot();

        var changes = snapshot.changedAttributes();

        deepEqual(changes.title, ["Hello World", "Hello World!"], "changed attributes are returned correctly");
      });
    });

    test("snapshot.belongsTo() returns undefined if relationship is undefined", function () {
      expect(1);

      run(function () {
        var comment = env.store.push("comment", { id: 1, body: "This is comment" });
        var snapshot = comment._createSnapshot();
        var relationship = snapshot.belongsTo("post");

        equal(relationship, undefined, "relationship is undefined");
      });
    });

    test("snapshot.belongsTo() returns null if relationship is unset", function () {
      expect(1);

      run(function () {
        env.store.push("post", { id: 1, title: "Hello World" });
        var comment = env.store.push("comment", { id: 2, body: "This is comment", post: null });
        var snapshot = comment._createSnapshot();
        var relationship = snapshot.belongsTo("post");

        equal(relationship, null, "relationship is unset");
      });
    });

    test("snapshot.belongsTo() returns a snapshot if relationship is set", function () {
      expect(3);

      run(function () {
        env.store.push("post", { id: 1, title: "Hello World" });
        var comment = env.store.push("comment", { id: 2, body: "This is comment", post: 1 });
        var snapshot = comment._createSnapshot();
        var relationship = snapshot.belongsTo("post");

        ok(relationship instanceof DS.Snapshot, "snapshot is an instance of DS.Snapshot");
        equal(relationship.id, "1", "post id is correct");
        equal(relationship.attr("title"), "Hello World", "post title is correct");
      });
    });

    test("snapshot.belongsTo() returns null if relationship is deleted", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var comment = env.store.push("comment", { id: 2, body: "This is comment", post: 1 });

        post.deleteRecord();

        var snapshot = comment._createSnapshot();
        var relationship = snapshot.belongsTo("post");

        equal(relationship, null, "relationship unset after deleted");
      });
    });

    test("snapshot.belongsTo() returns undefined if relationship is a link", function () {
      expect(1);

      run(function () {
        var comment = env.store.push("comment", { id: 2, body: "This is comment", links: { post: "post" } });
        var snapshot = comment._createSnapshot();
        var relationship = snapshot.belongsTo("post");

        equal(relationship, undefined, "relationship is undefined");
      });
    });

    test("snapshot.belongsTo() throws error if relation doesn't exist", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();

        throws(function () {
          snapshot.belongsTo("unknown");
        }, /has no belongsTo relationship named 'unknown'/, "throws error");
      });
    });

    test("snapshot.belongsTo() returns a snapshot if relationship link has been fetched", function () {
      expect(2);

      env.adapter.findBelongsTo = function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve({ id: 1, title: "Hello World" });
      };

      run(function () {
        var comment = env.store.push("comment", { id: 2, body: "This is comment", links: { post: "post" } });

        comment.get("post").then(function (post) {
          var snapshot = comment._createSnapshot();
          var relationship = snapshot.belongsTo("post");

          ok(relationship instanceof DS.Snapshot, "snapshot is an instance of DS.Snapshot");
          equal(relationship.id, "1", "post id is correct");
        });
      });
    });

    test("snapshot.belongsTo() and snapshot.hasMany() returns correctly when adding an object to a hasMany relationship", function () {
      expect(4);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var comment = env.store.push("comment", { id: 2, body: "blabla" });

        post.get("comments").then(function (comments) {
          comments.addObject(comment);

          var postSnapshot = post._createSnapshot();
          var commentSnapshot = comment._createSnapshot();

          var hasManyRelationship = postSnapshot.hasMany("comments");
          var belongsToRelationship = commentSnapshot.belongsTo("post");

          ok(hasManyRelationship instanceof Array, "hasMany relationship is an instance of Array");
          equal(hasManyRelationship.length, 1, "hasMany relationship contains related object");

          ok(belongsToRelationship instanceof DS.Snapshot, "belongsTo relationship is an instance of DS.Snapshot");
          equal(belongsToRelationship.attr("title"), "Hello World", "belongsTo relationship contains related object");
        });
      });
    });

    test("snapshot.belongsTo() and snapshot.hasMany() returns correctly when setting an object to a belongsTo relationship", function () {
      expect(4);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var comment = env.store.push("comment", { id: 2, body: "blabla" });

        comment.set("post", post);

        var postSnapshot = post._createSnapshot();
        var commentSnapshot = comment._createSnapshot();

        var hasManyRelationship = postSnapshot.hasMany("comments");
        var belongsToRelationship = commentSnapshot.belongsTo("post");

        ok(hasManyRelationship instanceof Array, "hasMany relationship is an instance of Array");
        equal(hasManyRelationship.length, 1, "hasMany relationship contains related object");

        ok(belongsToRelationship instanceof DS.Snapshot, "belongsTo relationship is an instance of DS.Snapshot");
        equal(belongsToRelationship.attr("title"), "Hello World", "belongsTo relationship contains related object");
      });
    });

    test("snapshot.belongsTo() returns ID if option.id is set", function () {
      expect(1);

      run(function () {
        env.store.push("post", { id: 1, title: "Hello World" });
        var comment = env.store.push("comment", { id: 2, body: "This is comment", post: 1 });
        var snapshot = comment._createSnapshot();
        var relationship = snapshot.belongsTo("post", { id: true });

        equal(relationship, "1", "relationship ID correctly returned");
      });
    });

    test("snapshot.belongsTo() returns null if option.id is set but relationship was deleted", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var comment = env.store.push("comment", { id: 2, body: "This is comment", post: 1 });

        post.deleteRecord();

        var snapshot = comment._createSnapshot();
        var relationship = snapshot.belongsTo("post", { id: true });

        equal(relationship, null, "relationship unset after deleted");
      });
    });

    test("snapshot.hasMany() returns undefined if relationship is undefined", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();
        var relationship = snapshot.hasMany("comments");

        equal(relationship, undefined, "relationship is undefined");
      });
    });

    test("snapshot.hasMany() returns empty array if relationship is unset", function () {
      expect(2);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World", comments: null });
        var snapshot = post._createSnapshot();
        var relationship = snapshot.hasMany("comments");

        ok(relationship instanceof Array, "relationship is an instance of Array");
        equal(relationship.length, 0, "relationship is empty");
      });
    });

    test("snapshot.hasMany() returns array of snapshots if relationship is set", function () {
      expect(5);

      run(function () {
        env.store.push("comment", { id: 1, body: "This is the first comment" });
        env.store.push("comment", { id: 2, body: "This is the second comment" });
        var post = env.store.push("post", { id: 3, title: "Hello World", comments: [1, 2] });
        var snapshot = post._createSnapshot();
        var relationship = snapshot.hasMany("comments");

        ok(relationship instanceof Array, "relationship is an instance of Array");
        equal(relationship.length, 2, "relationship has two items");

        var relationship1 = relationship[0];

        ok(relationship1 instanceof DS.Snapshot, "relationship item is an instance of DS.Snapshot");

        equal(relationship1.id, "1", "relationship item id is correct");
        equal(relationship1.attr("body"), "This is the first comment", "relationship item body is correct");
      });
    });

    test("snapshot.hasMany() returns empty array if relationship records are deleted", function () {
      expect(2);

      run(function () {
        var comment1 = env.store.push("comment", { id: 1, body: "This is the first comment" });
        var comment2 = env.store.push("comment", { id: 2, body: "This is the second comment" });
        var post = env.store.push("post", { id: 3, title: "Hello World", comments: [1, 2] });

        comment1.deleteRecord();
        comment2.deleteRecord();

        var snapshot = post._createSnapshot();
        var relationship = snapshot.hasMany("comments");

        ok(relationship instanceof Array, "relationship is an instance of Array");
        equal(relationship.length, 0, "relationship is empty");
      });
    });

    test("snapshot.hasMany() returns array of IDs if option.ids is set", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World", comments: [2, 3] });
        var snapshot = post._createSnapshot();
        var relationship = snapshot.hasMany("comments", { ids: true });

        deepEqual(relationship, ["2", "3"], "relationship IDs correctly returned");
      });
    });

    test("snapshot.hasMany() returns empty array of IDs if option.ids is set but relationship records were deleted", function () {
      expect(2);

      run(function () {
        var comment1 = env.store.push("comment", { id: 1, body: "This is the first comment" });
        var comment2 = env.store.push("comment", { id: 2, body: "This is the second comment" });
        var post = env.store.push("post", { id: 3, title: "Hello World", comments: [1, 1] });

        comment1.deleteRecord();
        comment2.deleteRecord();

        var snapshot = post._createSnapshot();
        var relationship = snapshot.hasMany("comments", { ids: true });

        ok(relationship instanceof Array, "relationship is an instance of Array");
        equal(relationship.length, 0, "relationship is empty");
      });
    });

    test("snapshot.hasMany() returns undefined if relationship is a link", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World", links: { comments: "comments" } });
        var snapshot = post._createSnapshot();
        var relationship = snapshot.hasMany("comments");

        equal(relationship, undefined, "relationship is undefined");
      });
    });

    test("snapshot.hasMany() returns array of snapshots if relationship link has been fetched", function () {
      expect(2);

      env.adapter.findHasMany = function (store, snapshot, link, relationship) {
        return Ember.RSVP.resolve([{ id: 2, body: "This is comment" }]);
      };

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World", links: { comments: "comments" } });

        post.get("comments").then(function (comments) {
          var snapshot = post._createSnapshot();
          var relationship = snapshot.hasMany("comments");

          ok(relationship instanceof Array, "relationship is an instance of Array");
          equal(relationship.length, 1, "relationship has one item");
        });
      });
    });

    test("snapshot.hasMany() throws error if relation doesn't exist", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();

        throws(function () {
          snapshot.hasMany("unknown");
        }, /has no hasMany relationship named 'unknown'/, "throws error");
      });
    });

    test("snapshot.hasMany() respects the order of items in the relationship", function () {
      expect(3);

      run(function () {
        env.store.push("comment", { id: 1, body: "This is the first comment" });
        env.store.push("comment", { id: 2, body: "This is the second comment" });
        var comment3 = env.store.push("comment", { id: 3, body: "This is the third comment" });
        var post = env.store.push("post", { id: 4, title: "Hello World", comments: [1, 2, 3] });

        post.get("comments").removeObject(comment3);
        post.get("comments").insertAt(0, comment3);

        var snapshot = post._createSnapshot();
        var relationship = snapshot.hasMany("comments");

        equal(relationship[0].id, "3", "order of comment 3 is correct");
        equal(relationship[1].id, "1", "order of comment 1 is correct");
        equal(relationship[2].id, "2", "order of comment 2 is correct");
      });
    });

    test("snapshot.eachAttribute() proxies to record", function () {
      expect(1);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();

        var attributes = [];
        snapshot.eachAttribute(function (name) {
          attributes.push(name);
        });
        deepEqual(attributes, ["author", "title"], "attributes are iterated correctly");
      });
    });

    test("snapshot.eachRelationship() proxies to record", function () {
      expect(2);

      var getRelationships = function (snapshot) {
        var relationships = [];
        snapshot.eachRelationship(function (name) {
          relationships.push(name);
        });
        return relationships;
      };

      run(function () {
        var comment = env.store.push("comment", { id: 1, body: "This is the first comment" });
        var post = env.store.push("post", { id: 2, title: "Hello World" });
        var snapshot;

        snapshot = comment._createSnapshot();
        deepEqual(getRelationships(snapshot), ["post"], "relationships are iterated correctly");

        snapshot = post._createSnapshot();
        deepEqual(getRelationships(snapshot), ["comments"], "relationships are iterated correctly");
      });
    });

    test("snapshot.belongsTo() does not trigger a call to store.scheduleFetch", function () {
      expect(0);

      env.store.scheduleFetch = function () {
        ok(false, "store.scheduleFetch should not be called");
      };

      run(function () {
        var comment = env.store.push("comment", { id: 2, body: "This is comment", post: 1 });
        var snapshot = comment._createSnapshot();

        snapshot.belongsTo("post");
      });
    });

    test("snapshot.hasMany() does not trigger a call to store.scheduleFetch", function () {
      expect(0);

      env.store.scheduleFetch = function () {
        ok(false, "store.scheduleFetch should not be called");
      };

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World", comments: [2, 3] });
        var snapshot = post._createSnapshot();

        snapshot.hasMany("comments");
      });
    });

    test("snapshot.serialize() serializes itself", function () {
      expect(2);

      run(function () {
        var post = env.store.push("post", { id: 1, title: "Hello World" });
        var snapshot = post._createSnapshot();

        post.set("title", "New Title");

        deepEqual(snapshot.serialize(), { author: undefined, title: "Hello World" }, "shapshot serializes correctly");
        deepEqual(snapshot.serialize({ includeId: true }), { id: "1", author: undefined, title: "Hello World" }, "serialize takes options");
      });
    });
  }
);


define(
  "ember-data/tests/integration/store-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var store, env;

    var Person = DS.Model.extend({
      name: DS.attr('string'),
      cars: DS.hasMany('car', { async: false })
    });

    var run = Ember.run;

    Person.toString = function () {
      return 'Person';
    };

    var Car = DS.Model.extend({
      make: DS.attr('string'),
      model: DS.attr('string'),
      person: DS.belongsTo('person', { async: false })
    });

    Car.toString = function () {
      return 'Car';
    };

    function initializeStore(adapter) {
      env = setupStore({
        adapter: adapter
      });
      store = env.store;

      env.registry.register('model:car', Car);
      env.registry.register('model:person', Person);
    }

    module('integration/store - destroy', {
      setup: function () {
        initializeStore(DS.Adapter.extend());
      }
    });

    function tap(obj, methodName, callback) {
      var old = obj[methodName];

      var summary = { called: [] };

      obj[methodName] = function () {
        var result = old.apply(obj, arguments);
        if (callback) {
          callback.apply(obj, arguments);
        }
        summary.called.push(arguments);
        return result;
      };

      return summary;
    }

    asyncTest('destroying record during find doesn\'t cause error', function () {
      expect(0);

      var TestAdapter = DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return new Ember.RSVP.Promise(function (resolve, reject) {
            Ember.run.next(function () {
              store.unloadAll(type.modelName);
              reject();
            });
          });
        }
      });

      initializeStore(TestAdapter);

      var type = 'car';
      var id = 1;

      function done() {
        start();
      }

      run(function () {
        store.findRecord(type, id).then(done, done);
      });
    });

    asyncTest('find calls do not resolve when the store is destroyed', function () {
      expect(0);

      var TestAdapter = DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          store.destroy();
          Ember.RSVP.resolve(null);
        }
      });

      initializeStore(TestAdapter);

      var type = 'car';
      var id = 1;

      store.push = function () {
        Ember.assert('The test should have destroyed the store by now', store.get('isDestroyed'));

        throw new Error('We shouldn\'t be pushing data into the store when it is destroyed');
      };

      run(function () {
        store.findRecord(type, id);
      });

      setTimeout(function () {
        start();
      }, 500);
    });

    test('destroying the store correctly cleans everything up', function () {
      var car, person;
      run(function () {
        car = store.push('car', {
          id: 1,
          make: 'BMC',
          model: 'Mini',
          person: 1
        });

        person = store.push('person', {
          id: 1,
          name: 'Tom Dale',
          cars: [1]
        });
      });

      var personWillDestroy = tap(person, 'willDestroy');
      var carWillDestroy = tap(car, 'willDestroy');
      var carsWillDestroy = tap(car.get('person.cars'), 'willDestroy');

      env.adapter.query = function () {
        return [{
          id: 2,
          name: 'Yehuda'
        }];
      };
      var adapterPopulatedPeople, filterdPeople;

      run(function () {
        adapterPopulatedPeople = store.query('person', {
          someCrazy: 'query'
        });
      });

      run(function () {
        filterdPeople = store.filter('person', function () {
          return true;
        });
      });

      var filterdPeopleWillDestroy = tap(filterdPeople.content, 'willDestroy');
      var adapterPopulatedPeopleWillDestroy = tap(adapterPopulatedPeople.content, 'willDestroy');

      run(function () {
        store.findRecord('person', 2);
      });

      equal(personWillDestroy.called.length, 0, 'expected person.willDestroy to not have been called');
      equal(carWillDestroy.called.length, 0, 'expected car.willDestroy to not have been called');
      equal(carsWillDestroy.called.length, 0, 'expected cars.willDestroy to not have been called');
      equal(adapterPopulatedPeopleWillDestroy.called.length, 0, 'expected adapterPopulatedPeople.willDestroy to not have been called');
      equal(filterdPeopleWillDestroy.called.length, 0, 'expected filterdPeople.willDestroy to not have been called');

      equal(filterdPeople.get('length'), 2, 'expected filterdPeople to have 2 entries');

      equal(car.get('person'), person, 'expected car\'s person to be the correct person');
      equal(person.get('cars.firstObject'), car, ' expected persons cars\'s firstRecord to be the correct car');

      Ember.run(person, person.destroy);
      Ember.run(store, 'destroy');

      equal(car.get('person'), null, 'expected car.person to no longer be present');

      equal(personWillDestroy.called.length, 1, 'expected person to have recieved willDestroy once');
      equal(carWillDestroy.called.length, 1, 'expected car to recieve willDestroy once');
      equal(carsWillDestroy.called.length, 1, 'expected cars to recieve willDestroy once');
      equal(adapterPopulatedPeopleWillDestroy.called.length, 1, 'expected adapterPopulatedPeople to recieve willDestroy once');
      equal(filterdPeopleWillDestroy.called.length, 1, 'expected filterdPeople.willDestroy to have been called once');
    });

    function ajaxResponse(value) {
      var passedUrl, passedVerb, passedHash;
      env.adapter.ajax = function (url, verb, hash) {
        passedUrl = url;
        passedVerb = verb;
        passedHash = hash;

        return run(Ember.RSVP, 'resolve', Ember.copy(value, true));
      };
    }

    module('integration/store - findRecord { reload: true }', {
      setup: function () {
        initializeStore(DS.RESTAdapter.extend());
      }
    });

    test('Using store#findRecord on non existing record fetches it from the server', function () {
      expect(2);

      env.registry.register('serializer:application', DS.RESTSerializer);
      ajaxResponse({
        cars: [{
          id: 20,
          make: 'BMCW',
          model: 'Mini'
        }]
      });

      var car = store.hasRecordForId('car', 20);
      ok(!car, 'Car with id=20 should not exist');

      run(function () {
        store.findRecord('car', 20, { reload: true }).then(function (car) {
          equal(car.get('make'), 'BMCW', 'Car with id=20 is now loaded');
        });
      });
    });

    test('Using store#findRecord on existing record reloads it', function () {
      expect(2);
      var car;

      run(function () {
        car = store.push('car', {
          id: 1,
          make: 'BMC',
          model: 'Mini'
        });
      });
      ajaxResponse({
        cars: [{
          id: 1,
          make: 'BMCW',
          model: 'Mini'
        }]
      });

      equal(car.get('make'), 'BMC');

      run(function () {
        store.findRecord('car', 1, { reload: true }).then(function (car) {
          equal(car.get('make'), 'BMCW');
        });
      });
    });

    module('integration/store - findAll', {
      setup: function () {
        initializeStore(DS.RESTAdapter.extend());
      }
    });

    test('Using store#findAll with no records triggers a query', function () {
      expect(2);

      ajaxResponse({
        cars: [{
          id: 1,
          make: 'BMC',
          model: 'Mini'
        }, {
          id: 2,
          make: 'BMCW',
          model: 'Isetta'
        }]
      });

      var cars = store.peekAll('car');
      ok(!cars.get('length'), 'There is no cars in the store');

      run(function () {
        store.findAll('car').then(function (cars) {
          equal(cars.get('length'), 2, 'Two car were fetched');
        });
      });
    });

    test('Using store#findAll with existing records performs a query, updating existing records and returning new ones', function () {
      expect(3);

      run(function () {
        store.push('car', {
          id: 1,
          make: 'BMC',
          model: 'Mini'
        });
      });

      ajaxResponse({
        cars: [{
          id: 1,
          make: 'BMC',
          model: 'New Mini'
        }, {
          id: 2,
          make: 'BMCW',
          model: 'Isetta'
        }]
      });

      var cars = store.peekAll('car');
      equal(cars.get('length'), 1, 'There is one car in the store');

      run(function () {
        store.findAll('car').then(function (cars) {
          equal(cars.get('length'), 2, 'There is 2 cars in the store now');
          var mini = cars.findBy('id', '1');
          equal(mini.get('model'), 'New Mini', 'Existing records have been updated');
        });
      });
    });

    test('store#findAll should return all known records even if they are not in the adapter response', function () {
      expect(4);

      run(function () {
        store.push('car', { id: 1, make: 'BMC', model: 'Mini' });
        store.push('car', { id: 2, make: 'BMCW', model: 'Isetta' });
      });

      ajaxResponse({
        cars: [{
          id: 1,
          make: 'BMC',
          model: 'New Mini'
        }]
      });

      var cars = store.peekAll('car');
      equal(cars.get('length'), 2, 'There is two cars in the store');

      run(function () {
        store.findAll('car').then(function (cars) {
          equal(cars.get('length'), 2, 'It returns all cars');
          var mini = cars.findBy('id', '1');
          equal(mini.get('model'), 'New Mini', 'Existing records have been updated');

          var carsInStore = store.peekAll('car');
          equal(carsInStore.get('length'), 2, 'There is 2 cars in the store');
        });
      });
    });

    test('Using store#fetch on an empty record calls find', function () {
      expect(2);

      ajaxResponse({
        cars: [{
          id: 20,
          make: 'BMCW',
          model: 'Mini'
        }]
      });

      run(function () {
        store.push('person', {
          id: 1,
          name: 'Tom Dale',
          cars: [20]
        });
      });

      var car = store.recordForId('car', 20);
      ok(car.get('isEmpty'), 'Car with id=20 should be empty');

      run(function () {
        store.findRecord('car', 20, { reload: true }).then(function (car) {
          equal(car.get('make'), 'BMCW', 'Car with id=20 is now loaded');
        });
      });
    });

    test('Using store#adapterFor should not throw an error when looking up the application adapter', function () {
      expect(1);

      run(function () {
        var applicationAdapter = store.adapterFor('application');
        ok(applicationAdapter);
      });
    });

    test('Using store#serializerFor should not throw an error when looking up the application serializer', function () {
      expect(1);

      run(function () {
        var applicationSerializer = store.serializerFor('application');
        ok(applicationSerializer);
      });
    });

    module('integration/store - deleteRecord', {
      setup: function () {
        initializeStore(DS.RESTAdapter.extend());
      }
    });

    test('Using store#deleteRecord should mark the model for removal', function () {
      expect(3);
      var person;

      run(function () {
        person = store.push('person', {
          id: 1,
          name: 'Tom Dale'
        });
      });

      ok(store.hasRecordForId('person', 1), 'expected the record to be in the store');

      var personDeleteRecord = tap(person, 'deleteRecord');

      run(function () {
        store.deleteRecord(person);
      });

      equal(personDeleteRecord.called.length, 1, 'expected person.deleteRecord to have been called');
      ok(person.get('isDeleted'), 'expect person to be isDeleted');
    });
  }
);


define(
  "ember-data/tests/integration/store/query-record-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Person, store, env;
    var run = Ember.run;

    module('integration/store/query-record - Query one record with a query hash', {
      setup: function () {
        Person = DS.Model.extend({
          updatedAt: DS.attr('string'),
          name: DS.attr('string'),
          firstName: DS.attr('string'),
          lastName: DS.attr('string')
        });

        env = setupStore({
          person: Person
        });
        store = env.store;
      },

      teardown: function () {
        run(store, 'destroy');
      }
    });

    test('It raises an assertion when no type is passed', function () {
      expectAssertion(function () {
        store.queryRecord();
      }, 'You need to pass a type to the store\'s queryRecord method');
    });

    test('It raises an assertion when no query hash is passed', function () {
      expectAssertion(function () {
        store.queryRecord('person');
      }, 'You need to pass a query hash to the store\'s queryRecord method');
    });

    test('When a record is requested, the adapter\'s queryRecord method should be called.', function () {
      expect(1);

      env.registry.register('adapter:person', DS.Adapter.extend({
        queryRecord: function (store, type, query) {
          equal(type, Person, 'the query method is called with the correct type');
          return Ember.RSVP.resolve({ id: 1, name: 'Peter Wagenet' });
        }
      }));

      run(function () {
        store.queryRecord('person', { related: 'posts' });
      });
    });

    test('When a record is requested, and the promise is rejected, .queryRecord() is rejected.', function () {
      env.registry.register('adapter:person', DS.Adapter.extend({
        queryRecord: function (store, type, query) {
          return Ember.RSVP.reject();
        }
      }));

      run(function () {
        store.queryRecord('person', {}).then(null, async(function (reason) {
          ok(true, 'The rejection handler was called');
        }));
      });
    });

    test('When a record is requested, the serializer\'s normalizeQueryRecordResponse method should be called.', function () {
      expect(1);

      env.registry.register('serializer:person', DS.JSONAPISerializer.extend({
        normalizeQueryRecordResponse: function (store, primaryModelClass, payload, id, requestType) {
          equal(payload.data.id, '1', 'the normalizeQueryRecordResponse method was called with the right payload');
          return this._super.apply(this, arguments);
        }
      }));

      env.registry.register('adapter:person', DS.Adapter.extend({
        queryRecord: function (store, type, query) {
          return Ember.RSVP.resolve({
            data: {
              id: '1',
              type: 'person',
              attributes: {
                name: 'Peter Wagenet'
              }
            }
          });
        }
      }));

      run(function () {
        store.queryRecord('person', { related: 'posts' });
      });
    });
  }
);


define(
  "ember-data/tests/unit/adapter-errors-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    module("unit/adapter/errors - DS.AdapterError");

    test("DS.AdapterError", function () {
      var error = new DS.AdapterError();
      ok(error instanceof Error);
      ok(error instanceof Ember.Error);
    });

    test("DS.InvalidError", function () {
      var error = new DS.InvalidError();
      ok(error instanceof Error);
      ok(error instanceof DS.AdapterError);
    });

    test("DS.TimeoutError", function () {
      var error = new DS.TimeoutError();
      ok(error instanceof Error);
      ok(error instanceof DS.AdapterError);
    });

    test("DS.AbortError", function () {
      var error = new DS.AbortError();
      ok(error instanceof Error);
      ok(error instanceof DS.AdapterError);
    });

    var errorsHash = {
      name: ["is invalid", "must be a string"],
      age: ["must be a number"]
    };

    var errorsArray = [{
      title: "Invalid Attribute",
      detail: "is invalid",
      source: { pointer: "data/attributes/name" }
    }, {
      title: "Invalid Attribute",
      detail: "must be a string",
      source: { pointer: "data/attributes/name" }
    }, {
      title: "Invalid Attribute",
      detail: "must be a number",
      source: { pointer: "data/attributes/age" }
    }];

    test("errorsHashToArray", function () {
      var result = DS.errorsHashToArray(errorsHash);
      deepEqual(result, errorsArray);
    });

    test("errorsArrayToHash", function () {
      var result = DS.errorsArrayToHash(errorsArray);
      deepEqual(result, errorsHash);
    });

    test("DS.InvalidError will normalize errors hash with deprecation", function () {
      var error;

      expectDeprecation(function () {
        error = new DS.InvalidError({ name: ["is invalid"] });
      }, /expects json-api formatted errors/);

      deepEqual(error.errors, [{
        title: "Invalid Attribute",
        detail: "is invalid",
        source: { pointer: "data/attributes/name" }
      }]);
    });
  }
);


define(
  "ember-data/tests/unit/adapter-populated-record-array-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Person, array, store;
    var run = Ember.run;

    var adapter = DS.Adapter.extend({
      deleteRecord: function () {
        return Ember.RSVP.Promise.resolve();
      }
    });

    module('unit/adapter_populated_record_array - DS.AdapterPopulatedRecordArray', {
      setup: function () {
        Person = DS.Model.extend({
          name: DS.attr('string')
        });

        store = createStore({
          adapter: adapter,
          person: Person
        });
        array = [{ id: '1', name: 'Scumbag Dale' }, { id: '2', name: 'Scumbag Katz' }, { id: '3', name: 'Scumbag Bryn' }];
      }
    });

    test('when a record is deleted in an adapter populated record array, it should be removed', function () {
      var recordArray = store.recordArrayManager.createAdapterPopulatedRecordArray(store.modelFor('person'), null);

      run(function () {
        recordArray.load(array);
      });

      equal(recordArray.get('length'), 3, 'expected recordArray to contain exactly 3 records');

      run(function () {
        recordArray.get('firstObject').destroyRecord();
      });

      equal(recordArray.get('length'), 2, 'expected recordArray to contain exactly 2 records');
    });

    test('recordArray.replace() throws error', function () {
      var recordArray = store.recordArrayManager.createAdapterPopulatedRecordArray(Person, null);

      throws(function () {
        recordArray.replace();
      }, Error('The result of a server query (on (subclass of DS.Model)) is immutable.'), 'throws error');
    });
  }
);


define(
  "ember-data/tests/unit/adapters/build-url-mixin/path-for-type-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, adapter;

    module('unit/adapters/build-url-mixin/path-for-type - DS.BuildURLMixin#pathForType', {
      setup: function () {

        // test for overriden pathForType methods which return null path values
        var customPathForType = {
          pathForType: function (type) {
            if (type === 'rootModel') {
              return '';
            }
            return this._super(type);
          }
        };

        var Adapter = DS.Adapter.extend(DS.BuildURLMixin, customPathForType);

        env = setupStore({
          adapter: Adapter
        });

        adapter = env.adapter;
      }
    });

    test('pathForType - works with camelized types', function () {
      equal(adapter.pathForType('superUser'), 'superUsers');
    });

    test('pathForType - works with dasherized types', function () {
      equal(adapter.pathForType('super-user'), 'superUsers');
    });

    test('pathForType - works with underscored types', function () {
      equal(adapter.pathForType('super_user'), 'superUsers');
    });

    test('buildURL - works with empty paths', function () {
      equal(adapter.buildURL('rootModel', 1), '/1');
    });

    test('buildURL - find requestType delegates to urlForFindRecord', function () {
      expect(4);
      var snapshotStub = { snapshot: true };
      var originalMethod = adapter.urlForFindRecord;
      adapter.urlForFindRecord = function (id, type, snapshot) {
        equal(id, 1);
        equal(type, 'super-user');
        equal(snapshot, snapshotStub);
        return originalMethod.apply(this, arguments);
      };
      equal(adapter.buildURL('super-user', 1, snapshotStub, 'findRecord'), '/superUsers/1');
    });

    test('buildURL - findAll requestType delegates to urlForFindAll', function () {
      expect(2);
      var originalMethod = adapter.urlForFindAll;
      adapter.urlForFindAll = function (type) {
        equal(type, 'super-user');
        return originalMethod.apply(this, arguments);
      };
      equal(adapter.buildURL('super-user', null, null, 'findAll'), '/superUsers');
    });

    test('buildURL - query requestType delegates to urlForQuery', function () {
      expect(3);
      var originalMethod = adapter.urlForQuery;
      var queryStub = { limit: 10 };
      adapter.urlForQuery = function (query, type) {
        equal(query, queryStub);
        equal(type, 'super-user');
        return originalMethod.apply(this, arguments);
      };
      equal(adapter.buildURL('super-user', null, null, 'query', queryStub), '/superUsers');
    });

    test('buildURL - findMany requestType delegates to urlForFindMany', function () {
      expect(3);
      var originalMethod = adapter.urlForFindMany;
      var idsStub = [1, 2, 3];
      adapter.urlForFindMany = function (ids, type) {
        equal(ids, idsStub);
        equal(type, 'super-user');
        return originalMethod.apply(this, arguments);
      };
      equal(adapter.buildURL('super-user', idsStub, null, 'findMany'), '/superUsers');
    });

    test('buildURL - findHasMany requestType delegates to urlForFindHasMany', function () {
      expect(3);
      var originalMethod = adapter.urlForFindHasMany;
      adapter.urlForFindHasMany = function (id, type) {
        equal(id, 1);
        equal(type, 'super-user');
        return originalMethod.apply(this, arguments);
      };
      equal(adapter.buildURL('super-user', 1, null, 'findHasMany'), '/superUsers/1');
    });

    test('buildURL - findBelongsTo requestType delegates to urlForFindBelongsTo', function () {
      expect(3);
      var originalMethod = adapter.urlForFindBelongsTo;
      adapter.urlForFindBelongsTo = function (id, type) {
        equal(id, 1);
        equal(type, 'super-user');
        return originalMethod.apply(this, arguments);
      };
      equal(adapter.buildURL('super-user', 1, null, 'findBelongsTo'), '/superUsers/1');
    });

    test('buildURL - createRecord requestType delegates to urlForCreateRecord', function () {
      expect(3);
      var snapshotStub = { snapshot: true };
      var originalMethod = adapter.urlForCreateRecord;
      adapter.urlForCreateRecord = function (type, snapshot) {
        equal(type, 'super-user');
        equal(snapshot, snapshotStub);
        return originalMethod.apply(this, arguments);
      };
      equal(adapter.buildURL('super-user', null, snapshotStub, 'createRecord'), '/superUsers');
    });

    test('buildURL - updateRecord requestType delegates to urlForUpdateRecord', function () {
      expect(4);
      var snapshotStub = { snapshot: true };
      var originalMethod = adapter.urlForUpdateRecord;
      adapter.urlForUpdateRecord = function (id, type, snapshot) {
        equal(id, 1);
        equal(type, 'super-user');
        equal(snapshot, snapshotStub);
        return originalMethod.apply(this, arguments);
      };
      equal(adapter.buildURL('super-user', 1, snapshotStub, 'updateRecord'), '/superUsers/1');
    });

    test('buildURL - deleteRecord requestType delegates to urlForDeleteRecord', function () {
      expect(4);
      var snapshotStub = { snapshot: true };
      var originalMethod = adapter.urlForDeleteRecord;
      adapter.urlForDeleteRecord = function (id, type, snapshot) {
        equal(id, 1);
        equal(type, 'super-user');
        equal(snapshot, snapshotStub);
        return originalMethod.apply(this, arguments);
      };
      equal(adapter.buildURL('super-user', 1, snapshotStub, 'deleteRecord'), '/superUsers/1');
    });

    test('buildURL - unknown requestType', function () {
      equal(adapter.buildURL('super-user', 1, null, 'unknown'), '/superUsers/1');
      equal(adapter.buildURL('super-user', null, null, 'unknown'), '/superUsers');
    });
  }
);


define(
  "ember-data/tests/unit/adapters/json-api-adapter/ajax-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Person, Place, store, adapter, env;
    var run = Ember.run;

    module('unit/adapters/json-api-adapter/ajax - building requests', {
      setup: function () {
        Person = { modelName: 'person' };
        Place = { modelName: 'place' };
        env = setupStore({ adapter: DS.JSONAPIAdapter, person: Person, place: Place });
        store = env.store;
        adapter = env.adapter;
      },

      teardown: function () {
        run(function () {
          store.destroy();
          env.container.destroy();
        });
      }
    });

    test('ajaxOptions() adds Accept when no other headers exist', function () {
      var url = 'example.com';
      var type = 'GET';
      var ajaxOptions = adapter.ajaxOptions(url, type, {});
      var receivedHeaders = [];
      var fakeXHR = {
        setRequestHeader: function (key, value) {
          receivedHeaders.push([key, value]);
        }
      };
      ajaxOptions.beforeSend(fakeXHR);
      deepEqual(receivedHeaders, [['Accept', 'application/vnd.api+json']], 'headers assigned');
    });

    test('ajaxOptions() adds Accept header to existing headers', function () {
      adapter.headers = { 'Other-key': 'Other Value' };
      var url = 'example.com';
      var type = 'GET';
      var ajaxOptions = adapter.ajaxOptions(url, type, {});
      var receivedHeaders = [];
      var fakeXHR = {
        setRequestHeader: function (key, value) {
          receivedHeaders.push([key, value]);
        }
      };
      ajaxOptions.beforeSend(fakeXHR);
      deepEqual(receivedHeaders, [['Accept', 'application/vnd.api+json'], ['Other-key', 'Other Value']], 'headers assigned');
    });

    test('ajaxOptions() adds Accept header to existing computed properties headers', function () {
      adapter.headers = Ember.computed(function () {
        return { 'Other-key': 'Other Value' };
      });
      var url = 'example.com';
      var type = 'GET';
      var ajaxOptions = adapter.ajaxOptions(url, type, {});
      var receivedHeaders = [];
      var fakeXHR = {
        setRequestHeader: function (key, value) {
          receivedHeaders.push([key, value]);
        }
      };
      ajaxOptions.beforeSend(fakeXHR);
      deepEqual(receivedHeaders, [['Accept', 'application/vnd.api+json'], ['Other-key', 'Other Value']], 'headers assigned');
    });
  }
);


define(
  "ember-data/tests/unit/adapters/rest-adapter/ajax-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Person, Place, store, adapter, env;
    var run = Ember.run;

    module('unit/adapters/rest-adapter/ajax - building requests', {
      setup: function () {
        Person = { modelName: 'person' };
        Place = { modelName: 'place' };
        env = setupStore({ adapter: DS.RESTAdapter, person: Person, place: Place });
        store = env.store;
        adapter = env.adapter;
      },

      teardown: function () {
        run(function () {
          store.destroy();
          env.container.destroy();
        });
      }
    });

    test('When an id is searched, the correct url should be generated', function () {
      expect(2);
      var count = 0;
      adapter.ajax = function (url, method) {
        if (count === 0) {
          equal(url, '/people/1', 'should create the correct url');
        }
        if (count === 1) {
          equal(url, '/places/1', 'should create the correct url');
        }
        count++;
        return Ember.RSVP.resolve();
      };
      run(function () {
        adapter.findRecord(store, Person, 1);
        adapter.findRecord(store, Place, 1);
      });
    });

    test('id\'s should be sanatized', function () {
      expect(1);
      adapter.ajax = function (url, method) {
        equal(url, '/people/..%2Fplace%2F1', 'should create the correct url');
        return Ember.RSVP.resolve();
      };
      run(function () {
        adapter.findRecord(store, Person, '../place/1');
      });
    });

    test('ajaxOptions() headers are set', function () {
      adapter.headers = { 'Content-Type': 'application/json', 'Other-key': 'Other Value' };
      var url = 'example.com';
      var type = 'GET';
      var ajaxOptions = adapter.ajaxOptions(url, type, {});
      var receivedHeaders = [];
      var fakeXHR = {
        setRequestHeader: function (key, value) {
          receivedHeaders.push([key, value]);
        }
      };
      ajaxOptions.beforeSend(fakeXHR);
      deepEqual(receivedHeaders, [['Content-Type', 'application/json'], ['Other-key', 'Other Value']], 'headers assigned');
    });

    test('ajaxOptions() do not serializes data when GET', function () {
      var url = 'example.com';
      var type = 'GET';
      var ajaxOptions = adapter.ajaxOptions(url, type, { data: { key: 'value' } });

      deepEqual(ajaxOptions, {
        context: adapter,
        data: {
          key: 'value'
        },
        dataType: 'json',
        type: 'GET',
        url: 'example.com'
      });
    });

    test('ajaxOptions() serializes data when not GET', function () {
      var url = 'example.com';
      var type = 'POST';
      var ajaxOptions = adapter.ajaxOptions(url, type, { data: { key: 'value' } });

      deepEqual(ajaxOptions, {
        contentType: 'application/json; charset=utf-8',
        context: adapter,
        data: '{"key":"value"}',
        dataType: 'json',
        type: 'POST',
        url: 'example.com'
      });
    });

    test('ajaxOptions() empty data', function () {
      var url = 'example.com';
      var type = 'POST';
      var ajaxOptions = adapter.ajaxOptions(url, type, {});

      deepEqual(ajaxOptions, {
        context: adapter,
        dataType: 'json',
        type: 'POST',
        url: 'example.com'
      });
    });
  }
);


define(
  "ember-data/tests/unit/adapters/rest-adapter/deprecated-adapter-methods",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var store = {};
    var type = "post";
    var id = 1;
    var snapshot = {};

    module("unit/adapters/rest-adapter/deprecated-adapter-methods - ");

    test("`findRecord` delegates to deprecated find method if it is supplied", function () {
      expect(2);

      var adapter = DS.RESTAdapter.extend({
        find: function () {
          ok(true, "overridden `find` method should be called");
        }
      }).create();

      expectDeprecation(function () {
        adapter.findRecord(store, type, id, snapshot);
      }, /RestAdapter#find has been deprecated and renamed to `findRecord`./);
    });

    test("`query` delegates to deprecated findQuery method if it is supplied", function () {
      expect(2);

      var adapter = DS.RESTAdapter.extend({
        findQuery: function () {
          ok(true, "overridden `findQuery` method should be called");
        }
      }).create();

      expectDeprecation(function () {
        adapter.query(store, type, id, snapshot);
      }, /RestAdapter#findQuery has been deprecated and renamed to `query`./);
    });
  }
);


define(
  "ember-data/tests/unit/adapters/rest-adapter/group-records-for-find-many-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var GroupsAdapter, Store;
    var maxLength = -1;
    var lengths = Ember.A([]);

    module('unit/adapters/rest_adapter/group_records_for_find_many_test - DS.RESTAdapter#groupRecordsForFindMany', {
      setup: function () {
        GroupsAdapter = DS.RESTAdapter.extend({

          coalesceFindRequests: true,

          findRecord: function (store, type, id, snapshot) {
            return Ember.RSVP.Promise.resolve({ id: id });
          },

          ajax: function (url, type, options) {
            var queryString = options.data.ids.map(function (i) {
              return encodeURIComponent('ids[]') + '=' + encodeURIComponent(i);
            }).join('&');
            var fullUrl = url + '?' + queryString;

            maxLength = this.get('maxURLLength');
            lengths.push(fullUrl.length);

            var testRecords = options.data.ids.map(function (id) {
              return { id: id };
            });
            return Ember.RSVP.Promise.resolve({ 'testRecords': testRecords });
          }

        });

        Store = createStore({
          adapter: GroupsAdapter,
          testRecord: DS.Model.extend()
        });
      }
    });

    test('groupRecordsForFindMany - findMany', function () {

      Ember.run(function () {
        for (var i = 1; i <= 1024; i++) {
          Store.find('testRecord', i);
        }
      });

      ok(lengths.every(function (len) {
        return len <= maxLength;
      }), 'Some URLs are longer than ' + maxLength + ' chars');
    });
  }
);


define("ember-data/tests/unit/debug-test", ["exports"], function(__exports__) {
  "use strict";

  function __es6_export__(name, value) {
    __exports__[name] = value;
  }

  var run = Ember.run;

  var TestAdapter = DS.Adapter.extend();

  module("Debug");

  test("_debugInfo groups the attributes and relationships correctly", function () {
    var MaritalStatus = DS.Model.extend({
      name: DS.attr("string")
    });

    var Post = DS.Model.extend({
      title: DS.attr("string")
    });

    var User = DS.Model.extend({
      name: DS.attr("string"),
      isDrugAddict: DS.attr("boolean"),
      maritalStatus: DS.belongsTo("marital-status", { async: false }),
      posts: DS.hasMany("post", { async: false })
    });

    var store = createStore({
      adapter: TestAdapter.extend(),
      maritalStatus: MaritalStatus,
      post: Post,
      user: User
    });
    var record;

    run(function () {
      record = store.createRecord("user");
    });

    var propertyInfo = record._debugInfo().propertyInfo;

    equal(propertyInfo.groups.length, 4);
    deepEqual(propertyInfo.groups[0].properties, ["id", "name", "isDrugAddict"]);
    deepEqual(propertyInfo.groups[1].properties, ["maritalStatus"]);
    deepEqual(propertyInfo.groups[2].properties, ["posts"]);
  });
});


define(
  "ember-data/tests/unit/many-array-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store;
    var attr = DS.attr;
    var hasMany = DS.hasMany;
    var belongsTo = DS.belongsTo;
    var run = Ember.run;

    var Post, Tag;

    module('unit/many_array - DS.ManyArray', {
      setup: function () {
        Post = DS.Model.extend({
          title: attr('string'),
          tags: hasMany('tag', { async: false })
        });
        Post.toString = function () {
          return 'Post';
        };

        Tag = DS.Model.extend({
          name: attr('string'),
          post: belongsTo('post', { async: false })
        });
        Tag.toString = function () {
          return 'Tag';
        };

        env = setupStore({
          post: Post,
          tag: Tag
        });
        store = env.store;
      },

      teardown: function () {
        run(function () {
          store.destroy();
        });
      }
    });

    test('manyArray.save() calls save() on all records', function () {
      expect(3);

      run(function () {
        Tag.reopen({
          save: function () {
            ok(true, 'record.save() was called');
            return Ember.RSVP.resolve();
          }
        });

        store.push('tag', { id: 1, name: 'Ember.js' });
        store.push('tag', { id: 2, name: 'Tomster' });

        var post = store.push('post', { id: 3, title: 'A framework for creating ambitious web applications', tags: [1, 2] });
        post.get('tags').save().then(function () {
          ok(true, 'manyArray.save() promise resolved');
        });
      });
    });

    test('manyArray trigger arrayContentChange functions with the correct values', function () {
      expect(12);
      var willChangeStartIdx;
      var willChangeRemoveAmt;
      var willChangeAddAmt;
      var originalArrayContentWillChange = DS.ManyArray.prototype.arrayContentWillChange;
      var originalArrayContentDidChange = DS.ManyArray.prototype.arrayContentDidChange;
      DS.ManyArray.reopen({
        arrayContentWillChange: function (startIdx, removeAmt, addAmt) {
          willChangeStartIdx = startIdx;
          willChangeRemoveAmt = removeAmt;
          willChangeAddAmt = addAmt;
          return this._super.apply(arguments);
        },
        arrayContentDidChange: function (startIdx, removeAmt, addAmt) {
          equal(startIdx, willChangeStartIdx, 'WillChange and DidChange startIdx should match');
          equal(removeAmt, willChangeRemoveAmt, 'WillChange and DidChange removeAmt should match');
          equal(addAmt, willChangeAddAmt, 'WillChange and DidChange addAmt should match');
          return this._super.apply(arguments);
        }
      });
      run(function () {
        store.push('tag', { id: 1, name: 'Ember.js' });
        store.push('tag', { id: 2, name: 'Ember Data' });
        var post = store.push('post', { id: 2, title: 'A framework for creating ambitious web applications', tags: [1] });
        post = store.push('post', { id: 2, title: 'A framework for creating ambitious web applications', tags: [1, 2] });
      });
      DS.ManyArray.reopen({
        arrayContentWillChange: originalArrayContentWillChange,
        arrayContentDidChange: originalArrayContentDidChange
      });
    });
  }
);


define("ember-data/tests/unit/model-test", ["exports"], function(__exports__) {
  "use strict";

  function __es6_export__(name, value) {
    __exports__[name] = value;
  }

  var get = Ember.get;
  var set = Ember.set;
  var run = Ember.run;

  var Person, store, array, env;

  module('unit/model - DS.Model', {
    setup: function () {
      Person = DS.Model.extend({
        name: DS.attr('string'),
        isDrugAddict: DS.attr('boolean')
      });

      env = setupStore({
        person: Person
      });
      store = env.store;
    },

    teardown: function () {
      run(function () {
        store.destroy();
      });
      Person = null;
      store = null;
    }
  });

  test('can have a property set on it', function () {
    var record;
    run(function () {
      record = store.createRecord('person');
      set(record, 'name', 'bar');
    });

    equal(get(record, 'name'), 'bar', 'property was set on the record');
  });

  test('setting a property on a record that has not changed does not cause it to become dirty', function () {
    expect(2);

    run(function () {
      store.push('person', { id: 1, name: 'Peter', isDrugAddict: true });
      store.findRecord('person', 1).then(function (person) {
        equal(person.get('hasDirtyAttributes'), false, 'precond - person record should not be dirty');

        person.set('name', 'Peter');
        person.set('isDrugAddict', true);

        equal(person.get('hasDirtyAttributes'), false, 'record does not become dirty after setting property to old value');
      });
    });
  });

  test('resetting a property on a record cause it to become clean again', function () {
    expect(3);

    run(function () {
      store.push('person', { id: 1, name: 'Peter', isDrugAddict: true });
      store.findRecord('person', 1).then(function (person) {
        equal(person.get('hasDirtyAttributes'), false, 'precond - person record should not be dirty');
        person.set('isDrugAddict', false);
        equal(person.get('hasDirtyAttributes'), true, 'record becomes dirty after setting property to a new value');
        person.set('isDrugAddict', true);
        equal(person.get('hasDirtyAttributes'), false, 'record becomes clean after resetting property to the old value');
      });
    });
  });

  test('a record becomes clean again only if all changed properties are reset', function () {
    expect(5);

    run(function () {
      store.push('person', { id: 1, name: 'Peter', isDrugAddict: true });
      store.findRecord('person', 1).then(function (person) {
        equal(person.get('hasDirtyAttributes'), false, 'precond - person record should not be dirty');
        person.set('isDrugAddict', false);
        equal(person.get('hasDirtyAttributes'), true, 'record becomes dirty after setting one property to a new value');
        person.set('name', 'Mark');
        equal(person.get('hasDirtyAttributes'), true, 'record stays dirty after setting another property to a new value');
        person.set('isDrugAddict', true);
        equal(person.get('hasDirtyAttributes'), true, 'record stays dirty after resetting only one property to the old value');
        person.set('name', 'Peter');
        equal(person.get('hasDirtyAttributes'), false, 'record becomes clean after resetting both properties to the old value');
      });
    });
  });

  test('a record reports its unique id via the `id` property', function () {
    expect(1);

    run(function () {
      store.push('person', { id: 1 });
      store.findRecord('person', 1).then(function (record) {
        equal(get(record, 'id'), 1, 'reports id as id by default');
      });
    });
  });

  test('a record\'s id is included in its toString representation', function () {
    expect(1);

    run(function () {
      store.push('person', { id: 1 });
      store.findRecord('person', 1).then(function (record) {
        equal(record.toString(), '<(subclass of DS.Model):' + Ember.guidFor(record) + ':1>', 'reports id in toString');
      });
    });
  });

  test('trying to set an `id` attribute should raise', function () {
    Person = DS.Model.extend({
      id: DS.attr('number'),
      name: DS.attr('string')
    });

    var store = createStore({
      person: Person
    });

    expectAssertion(function () {
      run(function () {
        store.push('person', { id: 1, name: 'Scumdale' });
        store.findRecord('person', 1);
      });
    }, /You may not set `id`/);
  });

  test('a collision of a record\'s id with object function\'s name', function () {
    expect(1);

    var hasWatchMethod = Object.prototype.watch;
    try {
      if (!hasWatchMethod) {
        Object.prototype.watch = function () {};
      }
      run(function () {
        store.push('person', { id: 'watch' });
        store.findRecord('person', 'watch').then(function (record) {
          equal(get(record, 'id'), 'watch', 'record is successfully created and could be found by its id');
        });
      });
    } finally {
      if (!hasWatchMethod) {
        delete Object.prototype.watch;
      }
    }
  });

  /*
  test("it should use `_internalModel` and not `internalModel` to store its internalModel", function() {
    expect(1);

    run(function() {
      store.push('person', { id: 1 });

      store.findRecord(Person, 1).then(function(record) {
        equal(record.get('_internalModel'), undefined, "doesn't shadow internalModel key");
      });
    });
  });
  */

  test('it should cache attributes', function () {
    expect(2);

    var Post = DS.Model.extend({
      updatedAt: DS.attr('string')
    });

    var store = createStore({
      post: Post
    });

    var dateString = 'Sat, 31 Dec 2011 00:08:16 GMT';
    var date = new Date(dateString);

    run(function () {
      store.push('post', { id: 1 });
      store.findRecord('post', 1).then(function (record) {
        run(function () {
          record.set('updatedAt', date);
        });
        deepEqual(date, get(record, 'updatedAt'), 'setting a date returns the same date');
        strictEqual(get(record, 'updatedAt'), get(record, 'updatedAt'), 'second get still returns the same object');
      })["finally"](function () {
        run(store, 'destroy');
      });
    });
  });

  test('changedAttributes() return correct values', function () {
    expect(4);

    var Mascot = DS.Model.extend({
      name: DS.attr('string'),
      likes: DS.attr('string'),
      isMascot: DS.attr('boolean')
    });

    var store = createStore({
      mascot: Mascot
    });

    var mascot;

    run(function () {
      mascot = store.push('mascot', { id: 1, likes: 'JavaScript', isMascot: true });
    });

    equal(Object.keys(mascot.changedAttributes()).length, 0, 'there are no initial changes');
    run(function () {
      mascot.set('name', 'Tomster'); // new value
      mascot.set('likes', 'Ember.js'); // changed value
      mascot.set('isMascot', true); // same value
    });
    var changedAttributes = mascot.changedAttributes();
    deepEqual(changedAttributes.name, [undefined, 'Tomster']);
    deepEqual(changedAttributes.likes, ['JavaScript', 'Ember.js']);

    run(function () {
      mascot.rollbackAttributes();
    });
    equal(Object.keys(mascot.changedAttributes()).length, 0, 'after rollback attributes there are no changes');
  });

  test('a DS.Model does not require an attribute type', function () {
    var Tag = DS.Model.extend({
      name: DS.attr()
    });

    var store = createStore({
      tag: Tag
    });

    var tag;

    run(function () {
      tag = store.createRecord('tag', { name: 'test' });
    });

    equal(get(tag, 'name'), 'test', 'the value is persisted');
  });

  test('a DS.Model can have a defaultValue without an attribute type', function () {
    var Tag = DS.Model.extend({
      name: DS.attr({ defaultValue: 'unknown' })
    });

    var store = createStore({
      tag: Tag
    });
    var tag;

    run(function () {
      tag = store.createRecord('tag');
    });

    equal(get(tag, 'name'), 'unknown', 'the default value is found');
  });

  test('Calling attr(), belongsTo() or hasMany() throws a warning', function () {
    expect(3);

    var Person = DS.Model.extend({
      name: DS.attr('string')
    });

    var store = createStore({
      person: Person
    });

    run(function () {
      var person = store.createRecord('person', { id: 1, name: 'TomHuda' });

      throws(function () {
        person.attr();
      }, /The `attr` method is not available on DS.Model, a DS.Snapshot was probably expected/, 'attr() throws a warning');

      throws(function () {
        person.belongsTo();
      }, /The `belongsTo` method is not available on DS.Model, a DS.Snapshot was probably expected/, 'belongTo() throws a warning');

      throws(function () {
        person.hasMany();
      }, /The `hasMany` method is not available on DS.Model, a DS.Snapshot was probably expected/, 'hasMany() throws a warning');
    });
  });

  test('supports pushedData in root.deleted.uncommitted', function () {
    var record;
    var hash = { id: 1 };
    run(function () {
      record = store.push('person', hash);
      record.deleteRecord();
      store.push('person', hash);
      equal(get(record, 'currentState.stateName'), 'root.deleted.uncommitted', 'record accepts pushedData is in root.deleted.uncommitted state');
    });
  });

  test('currentState is accessible when the record is created', function () {
    var record;
    var hash = { id: 1 };
    run(function () {
      record = store.push('person', hash);
      equal(get(record, 'currentState.stateName'), 'root.loaded.saved', 'records pushed into the store start in the loaded state');
    });
  });

  module('unit/model - DS.Model updating', {
    setup: function () {
      array = [{ id: 1, name: 'Scumbag Dale' }, { id: 2, name: 'Scumbag Katz' }, { id: 3, name: 'Scumbag Bryn' }];
      Person = DS.Model.extend({ name: DS.attr('string') });
      env = setupStore({
        person: Person
      });
      store = env.store;
      run(function () {
        store.pushMany('person', array);
      });
    },
    teardown: function () {
      run(function () {
        store.destroy();
        Person = null;
        store = null;
        array = null;
      });
    }
  });

  test('a DS.Model can update its attributes', function () {
    expect(1);

    run(function () {
      store.findRecord('person', 2).then(function (person) {
        set(person, 'name', 'Brohuda Katz');
        equal(get(person, 'name'), 'Brohuda Katz', 'setting took hold');
      });
    });
  });

  test('a DS.Model can have a defaultValue', function () {
    var Tag = DS.Model.extend({
      name: DS.attr('string', { defaultValue: 'unknown' })
    });
    var tag;

    var store = createStore({
      tag: Tag
    });

    run(function () {
      tag = store.createRecord('tag');
    });

    equal(get(tag, 'name'), 'unknown', 'the default value is found');

    run(function () {
      set(tag, 'name', null);
    });

    equal(get(tag, 'name'), null, 'null doesn\'t shadow defaultValue');
  });

  test('a DS.model can define \'setUnknownProperty\'', function () {
    var tag;
    var Tag = DS.Model.extend({
      name: DS.attr('string'),

      setUnknownProperty: function (key, value) {
        if (key === 'title') {
          this.set('name', value);
        }
      }
    });

    var store = createStore({
      tag: Tag
    });

    run(function () {
      tag = store.createRecord('tag', { name: 'old' });
      set(tag, 'title', 'new');
    });

    equal(get(tag, 'name'), 'new', 'setUnknownProperty not triggered');
  });

  test('a defaultValue for an attribute can be a function', function () {
    var Tag = DS.Model.extend({
      createdAt: DS.attr('string', {
        defaultValue: function () {
          return 'le default value';
        }
      })
    });
    var tag;

    var store = createStore({
      tag: Tag
    });

    run(function () {
      tag = store.createRecord('tag');
    });
    equal(get(tag, 'createdAt'), 'le default value', 'the defaultValue function is evaluated');
  });

  test('a defaultValue function gets the record, options, and key', function () {
    expect(2);

    var Tag = DS.Model.extend({
      createdAt: DS.attr('string', {
        defaultValue: function (record, options, key) {
          deepEqual(record, tag, 'the record is passed in properly');
          equal(key, 'createdAt', 'the attribute being defaulted is passed in properly');
          return 'le default value';
        }
      })
    });

    var store = createStore({
      tag: Tag
    });
    var tag;

    run(function () {
      tag = store.createRecord('tag');
    });

    get(tag, 'createdAt');
  });

  test('setting a property to undefined on a newly created record should not impact the current state', function () {
    var Tag = DS.Model.extend({
      name: DS.attr('string')
    });

    var store = createStore({
      tag: Tag
    });

    var tag;

    run(function () {
      tag = store.createRecord('tag');
      set(tag, 'name', 'testing');
      set(tag, 'name', undefined);
    });

    equal(get(tag, 'currentState.stateName'), 'root.loaded.created.uncommitted');

    run(function () {
      tag = store.createRecord('tag', { name: undefined });
    });

    equal(get(tag, 'currentState.stateName'), 'root.loaded.created.uncommitted');
  });

  // NOTE: this is a 'backdoor' test that ensures internal consistency, and should be
  // thrown out if/when the current `_attributes` hash logic is removed.
  test('setting a property back to its original value removes the property from the `_attributes` hash', function () {
    expect(3);

    run(function () {
      store.findRecord('person', 1).then(function (person) {
        equal(person._internalModel._attributes.name, undefined, 'the `_attributes` hash is clean');

        set(person, 'name', 'Niceguy Dale');

        equal(person._internalModel._attributes.name, 'Niceguy Dale', 'the `_attributes` hash contains the changed value');

        set(person, 'name', 'Scumbag Dale');

        equal(person._internalModel._attributes.name, undefined, 'the `_attributes` hash is reset');
      });
    });
  });

  module('unit/model - with a simple Person model', {
    setup: function () {
      array = [{ id: 1, name: 'Scumbag Dale' }, { id: 2, name: 'Scumbag Katz' }, { id: 3, name: 'Scumbag Bryn' }];
      Person = DS.Model.extend({
        name: DS.attr('string')
      });
      store = createStore({
        person: Person
      });
      run(function () {
        store.pushMany('person', array);
      });
    },
    teardown: function () {
      run(function () {
        store.destroy();
        Person = null;
        store = null;
        array = null;
      });
    }
  });

  test('can ask if record with a given id is loaded', function () {
    equal(store.recordIsLoaded('person', 1), true, 'should have person with id 1');
    equal(store.recordIsLoaded('person', 1), true, 'should have person with id 1');
    equal(store.recordIsLoaded('person', 4), false, 'should not have person with id 4');
    equal(store.recordIsLoaded('person', 4), false, 'should not have person with id 4');
  });

  test('a listener can be added to a record', function () {
    var count = 0;
    var F = function () {
      count++;
    };
    var record;

    run(function () {
      record = store.createRecord('person');
    });

    record.on('event!', F);
    run(function () {
      record.trigger('event!');
    });

    equal(count, 1, 'the event was triggered');

    run(function () {
      record.trigger('event!');
    });

    equal(count, 2, 'the event was triggered');
  });

  test('when an event is triggered on a record the method with the same name is invoked with arguments', function () {
    var count = 0;
    var F = function () {
      count++;
    };
    var record;

    run(function () {
      record = store.createRecord('person');
    });

    record.eventNamedMethod = F;

    run(function () {
      record.trigger('eventNamedMethod');
    });

    equal(count, 1, 'the corresponding method was called');
  });

  test('when a method is invoked from an event with the same name the arguments are passed through', function () {
    var eventMethodArgs = null;
    var F = function () {
      eventMethodArgs = arguments;
    };
    var record;

    run(function () {
      record = store.createRecord('person');
    });

    record.eventThatTriggersMethod = F;

    run(function () {
      record.trigger('eventThatTriggersMethod', 1, 2);
    });

    equal(eventMethodArgs[0], 1);
    equal(eventMethodArgs[1], 2);
  });

  var converts = function (type, provided, expected) {
    var Model = DS.Model.extend({
      name: DS.attr(type)
    });

    var registry, container;
    if (Ember.Registry) {
      registry = new Ember.Registry();
      container = registry.container();
    } else {
      container = new Ember.Container();
      registry = container;
    }
    var testStore = createStore({ model: Model });

    run(function () {
      testStore.push(testStore.normalize('model', { id: 1, name: provided }));
      testStore.push(testStore.normalize('model', { id: 2 }));
      testStore.findRecord('model', 1).then(function (record) {
        deepEqual(get(record, 'name'), expected, type + ' coerces ' + provided + ' to ' + expected);
      });
    });

    // See: Github issue #421
    // record = testStore.find(Model, 2);
    // set(record, 'name', provided);
    // deepEqual(get(record, 'name'), expected, type + " coerces " + provided + " to " + expected);
  };

  var convertsFromServer = function (type, provided, expected) {
    var Model = DS.Model.extend({
      name: DS.attr(type)
    });

    var registry, container;
    if (Ember.Registry) {
      registry = new Ember.Registry();
      container = registry.container();
    } else {
      container = new Ember.Container();
      registry = container;
    }
    var testStore = createStore({ model: Model });

    run(function () {
      testStore.push(testStore.normalize('model', { id: '1', name: provided }));
      testStore.findRecord('model', 1).then(function (record) {
        deepEqual(get(record, 'name'), expected, type + ' coerces ' + provided + ' to ' + expected);
      });
    });
  };

  var convertsWhenSet = function (type, provided, expected) {
    var Model = DS.Model.extend({
      name: DS.attr(type)
    });

    var testStore = createStore({ model: Model });

    run(function () {
      testStore.push('model', { id: 2 });
      testStore.findRecord('model', 2).then(function (record) {
        set(record, 'name', provided);
        deepEqual(record.serialize().name, expected, type + ' saves ' + provided + ' as ' + expected);
      });
    });
  };

  test('a DS.Model can describe String attributes', function () {
    expect(6);

    converts('string', 'Scumbag Tom', 'Scumbag Tom');
    converts('string', 1, '1');
    converts('string', '', '');
    converts('string', null, null);
    converts('string', undefined, null);
    convertsFromServer('string', undefined, null);
  });

  test('a DS.Model can describe Number attributes', function () {
    expect(9);

    converts('number', '1', 1);
    converts('number', '0', 0);
    converts('number', 1, 1);
    converts('number', 0, 0);
    converts('number', '', null);
    converts('number', null, null);
    converts('number', undefined, null);
    converts('number', true, 1);
    converts('number', false, 0);
  });

  test('a DS.Model can describe Boolean attributes', function () {
    expect(7);

    converts('boolean', '1', true);
    converts('boolean', '', false);
    converts('boolean', 1, true);
    converts('boolean', 0, false);
    converts('boolean', null, false);
    converts('boolean', true, true);
    converts('boolean', false, false);
  });

  test('a DS.Model can describe Date attributes', function () {
    expect(5);

    converts('date', null, null);
    converts('date', undefined, undefined);

    var dateString = '2011-12-31T00:08:16.000Z';
    var date = new Date(Ember.Date.parse(dateString));

    var Person = DS.Model.extend({
      updatedAt: DS.attr('date')
    });

    var store = createStore({
      person: Person
    });

    run(function () {
      store.push('person', { id: 1 });
      store.findRecord('person', 1).then(function (record) {
        run(function () {
          record.set('updatedAt', date);
        });
        deepEqual(date, get(record, 'updatedAt'), 'setting a date returns the same date');
      });
    });
    convertsFromServer('date', dateString, date);
    convertsWhenSet('date', date, dateString);
  });

  test('don\'t allow setting', function () {
    var Person = DS.Model.extend();
    var record;

    var store = createStore({
      person: Person
    });

    run(function () {
      record = store.createRecord('person');
    });

    raises(function () {
      run(function () {
        record.set('isLoaded', true);
      });
    }, 'raised error when trying to set an unsettable record');
  });

  test('ensure model exits loading state, materializes data and fulfills promise only after data is available', function () {
    expect(2);

    var store = createStore({
      adapter: DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.resolve({ id: 1, name: 'John' });
        }
      }),
      person: Person
    });

    run(function () {
      store.findRecord('person', 1).then(function (person) {
        equal(get(person, 'currentState.stateName'), 'root.loaded.saved', 'model is in loaded state');
        equal(get(person, 'isLoaded'), true, 'model is loaded');
      });
    });
  });

  test('A DS.Model can be JSONified', function () {
    var Person = DS.Model.extend({
      name: DS.attr('string')
    });

    var store = createStore({ person: Person });
    var record;

    run(function () {
      record = store.createRecord('person', { name: 'TomHuda' });
    });
    deepEqual(record.toJSON(), { name: 'TomHuda' });
  });

  test('A subclass of DS.Model can not use the `data` property', function () {
    var Person = DS.Model.extend({
      data: DS.attr('string'),
      name: DS.attr('string')
    });

    var store = createStore({ person: Person });

    expectAssertion(function () {
      run(function () {
        store.createRecord('person', { name: 'TomHuda' });
      });
    }, /`data` is a reserved property name on DS.Model objects/);
  });

  test('A subclass of DS.Model can not use the `store` property', function () {
    var Retailer = DS.Model.extend({
      store: DS.attr(),
      name: DS.attr()
    });

    var store = createStore({ retailer: Retailer });

    expectAssertion(function () {
      run(function () {
        store.createRecord('retailer', { name: 'Buy n Large' });
      });
    }, /`store` is a reserved property name on DS.Model objects/);
  });

  test('A subclass of DS.Model can not use reserved properties', function () {
    expect(3);
    ['currentState', 'data', 'store'].forEach(function (reservedProperty) {
      var invalidExtendObject = {};
      invalidExtendObject[reservedProperty] = DS.attr();
      var Post = DS.Model.extend(invalidExtendObject);

      var store = createStore({ post: Post });

      expectAssertion(function () {
        run(function () {
          store.createRecord('post', {});
        });
      }, /is a reserved property name on DS.Model objects/);
    });
  });

  test('Pushing a record into the store should transition it to the loaded state', function () {
    var Person = DS.Model.extend({
      name: DS.attr('string')
    });

    var store = createStore({ person: Person });

    run(function () {
      var person = store.createRecord('person', { id: 1, name: 'TomHuda' });
      equal(person.get('isNew'), true, 'createRecord should put records into the new state');
      store.push('person', { id: 1, name: 'TomHuda' });
      equal(person.get('isNew'), false, 'push should put records into the loaded state');
    });
  });

  test('A subclass of DS.Model throws an error when calling create() directly', function () {
    throws(function () {
      Person.create();
    }, /You should not call `create` on a model/, 'Throws an error when calling create() on model');
  });

  test('toJSON looks up the JSONSerializer using the store instead of using JSONSerializer.create', function () {
    var Person = DS.Model.extend({
      posts: DS.hasMany('post', { async: false })
    });
    var Post = DS.Model.extend({
      person: DS.belongsTo('person', { async: false })
    });

    var env = setupStore({
      person: Person,
      post: Post
    });
    var store = env.store;

    var person, json;
    // Loading the person without explicitly
    // loading its relationships seems to trigger the
    // original bug where `this.store` was not
    // present on the serializer due to using .create
    // instead of `store.serializerFor`.
    run(function () {
      person = store.push('person', {
        id: 1
      });
    });
    var errorThrown = false;
    try {
      json = run(person, 'toJSON');
    } catch (e) {
      errorThrown = true;
    }

    ok(!errorThrown, 'error not thrown due to missing store');
    deepEqual(json, {});
  });

  test('accessing attributes in the initializer should not throw an error', function () {
    expect(1);
    var Person = DS.Model.extend({
      name: DS.attr('string'),

      init: function () {
        this._super.apply(this, arguments);
        ok(!this.get('name'));
      }
    });

    var env = setupStore({
      person: Person
    });
    var store = env.store;

    run(function () {
      return store.createRecord('person');
    });
  });
});


define(
  "ember-data/tests/unit/model/errors-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var errors;

    module('unit/model/errors', {
      setup: function () {
        errors = DS.Errors.create();
      },

      teardown: function () {}
    });

    function becameInvalid(eventName) {
      if (eventName === 'becameInvalid') {
        ok(true, 'becameInvalid send');
      } else {
        ok(false, eventName + ' is send instead of becameInvalid');
      }
    }

    function becameValid(eventName) {
      if (eventName === 'becameValid') {
        ok(true, 'becameValid send');
      } else {
        ok(false, eventName + ' is send instead of becameValid');
      }
    }

    function unexpectedSend(eventName) {
      ok(false, 'unexpected send : ' + eventName);
    }

    test('add error', function () {
      expect(6);
      errors.trigger = becameInvalid;
      errors.add('firstName', 'error');
      errors.trigger = unexpectedSend;
      ok(errors.has('firstName'), 'it has firstName errors');
      equal(errors.get('length'), 1, 'it has 1 error');
      errors.add('firstName', ['error1', 'error2']);
      equal(errors.get('length'), 3, 'it has 3 errors');
      ok(!errors.get('isEmpty'), 'it is not empty');
      errors.add('lastName', 'error');
      errors.add('lastName', 'error');
      equal(errors.get('length'), 4, 'it has 4 errors');
    });

    test('get error', function () {
      expect(8);
      ok(errors.get('firstObject') === undefined, 'returns undefined');
      errors.trigger = becameInvalid;
      errors.add('firstName', 'error');
      errors.trigger = unexpectedSend;
      ok(errors.get('firstName').length === 1, 'returns errors');
      deepEqual(errors.get('firstObject'), { attribute: 'firstName', message: 'error' });
      errors.add('firstName', 'error2');
      ok(errors.get('firstName').length === 2, 'returns errors');
      errors.add('lastName', 'error3');
      deepEqual(errors.toArray(), [{ attribute: 'firstName', message: 'error' }, { attribute: 'firstName', message: 'error2' }, { attribute: 'lastName', message: 'error3' }]);
      deepEqual(errors.get('firstName'), [{ attribute: 'firstName', message: 'error' }, { attribute: 'firstName', message: 'error2' }]);
      deepEqual(errors.get('messages'), ['error', 'error2', 'error3']);
    });

    test('remove error', function () {
      expect(5);
      errors.trigger = becameInvalid;
      errors.add('firstName', 'error');
      errors.trigger = becameValid;
      errors.remove('firstName');
      errors.trigger = unexpectedSend;
      ok(!errors.has('firstName'), 'it has no firstName errors');
      equal(errors.get('length'), 0, 'it has 0 error');
      ok(errors.get('isEmpty'), 'it is empty');
      errors.remove('firstName');
    });

    test('remove same errors from different attributes', function () {
      expect(5);
      errors.trigger = becameInvalid;
      errors.add('firstName', 'error');
      errors.add('lastName', 'error');
      errors.trigger = unexpectedSend;
      equal(errors.get('length'), 2, 'it has 2 error');
      errors.remove('firstName');
      equal(errors.get('length'), 1, 'it has 1 error');
      errors.trigger = becameValid;
      errors.remove('lastName');
      ok(errors.get('isEmpty'), 'it is empty');
    });

    test('clear errors', function () {
      expect(5);
      errors.trigger = becameInvalid;
      errors.add('firstName', ['error', 'error1']);
      equal(errors.get('length'), 2, 'it has 2 errors');
      errors.trigger = becameValid;
      errors.clear();
      errors.trigger = unexpectedSend;
      ok(!errors.has('firstName'), 'it has no firstName errors');
      equal(errors.get('length'), 0, 'it has 0 error');
      errors.clear();
    });
  }
);


define(
  "ember-data/tests/unit/model/internal-model-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    module("unit/model/internal-model - Internal Model");

    var mockModelFactory = {
      _create: function () {
        return { trigger: function () {} };
      },

      eachRelationship: function () {}
    };
    test("Materializing a model twice errors out", function () {
      expect(1);
      var internalModel = new DS.InternalModel(mockModelFactory, null, null, null);

      internalModel.materializeRecord();
      expectAssertion(function () {
        internalModel.materializeRecord();
      }, /more than once/);
    });
  }
);


define(
  "ember-data/tests/unit/model/lifecycle-callbacks-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var run = Ember.run;

    module("unit/model/lifecycle_callbacks - Lifecycle Callbacks");

    test("a record receives a didLoad callback when it has finished loading", function () {
      expect(3);

      var Person = DS.Model.extend({
        name: DS.attr(),
        didLoad: function () {
          ok("The didLoad callback was called");
        }
      });

      var adapter = DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.resolve({ id: 1, name: "Foo" });
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });

      run(function () {
        store.findRecord("person", 1).then(function (person) {
          equal(person.get("id"), "1", "The person's ID is available");
          equal(person.get("name"), "Foo", "The person's properties are available");
        });
      });
    });

    test("TEMPORARY: a record receives a didLoad callback once it materializes if it wasn't materialized when loaded", function () {
      expect(2);
      var didLoadCalled = 0;
      var Person = DS.Model.extend({
        name: DS.attr(),
        didLoad: function () {
          didLoadCalled++;
        }
      });

      var store = createStore({
        person: Person
      });

      run(function () {
        store._pushInternalModel({ id: 1, type: "person" });
        equal(didLoadCalled, 0, "didLoad was not called");
      });
      run(function () {
        store.peekRecord("person", 1);
      });
      run(function () {
        equal(didLoadCalled, 1, "didLoad was called");
      });
    });

    test("a record receives a didUpdate callback when it has finished updating", function () {
      expect(5);

      var callCount = 0;

      var Person = DS.Model.extend({
        bar: DS.attr("string"),
        name: DS.attr("string"),

        didUpdate: function () {
          callCount++;
          equal(get(this, "isSaving"), false, "record should be saving");
          equal(get(this, "hasDirtyAttributes"), false, "record should not be dirty");
        }
      });

      var adapter = DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.resolve({ id: 1, name: "Foo" });
        },

        updateRecord: function (store, type, snapshot) {
          equal(callCount, 0, "didUpdate callback was not called until didSaveRecord is called");

          return Ember.RSVP.resolve();
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });
      var asyncPerson;

      run(function () {
        asyncPerson = store.findRecord("person", 1);
      });
      equal(callCount, 0, "precond - didUpdate callback was not called yet");

      run(function () {
        asyncPerson.then(function (person) {
          return run(function () {
            person.set("bar", "Bar");
            return person.save();
          });
        }).then(function () {
          equal(callCount, 1, "didUpdate called after update");
        });
      });
    });

    test("a record receives a didCreate callback when it has finished updating", function () {
      expect(5);

      var callCount = 0;

      var Person = DS.Model.extend({
        didCreate: function () {
          callCount++;
          equal(get(this, "isSaving"), false, "record should not be saving");
          equal(get(this, "hasDirtyAttributes"), false, "record should not be dirty");
        }
      });

      var adapter = DS.Adapter.extend({
        createRecord: function (store, type, snapshot) {
          equal(callCount, 0, "didCreate callback was not called until didSaveRecord is called");

          return Ember.RSVP.resolve();
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });

      equal(callCount, 0, "precond - didCreate callback was not called yet");
      var person;

      run(function () {
        person = store.createRecord("person", { id: 69, name: "Newt Gingrich" });
      });

      run(function () {
        person.save().then(function () {
          equal(callCount, 1, "didCreate called after commit");
        });
      });
    });

    test("a record receives a didDelete callback when it has finished deleting", function () {
      expect(5);

      var callCount = 0;

      var Person = DS.Model.extend({
        bar: DS.attr("string"),
        name: DS.attr("string"),

        didDelete: function () {
          callCount++;

          equal(get(this, "isSaving"), false, "record should not be saving");
          equal(get(this, "hasDirtyAttributes"), false, "record should not be dirty");
        }
      });

      var adapter = DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.resolve({ id: 1, name: "Foo" });
        },

        deleteRecord: function (store, type, snapshot) {
          equal(callCount, 0, "didDelete callback was not called until didSaveRecord is called");

          return Ember.RSVP.resolve();
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });
      var asyncPerson;

      run(function () {
        asyncPerson = store.findRecord("person", 1);
      });

      equal(callCount, 0, "precond - didDelete callback was not called yet");

      run(function () {
        asyncPerson.then(function (person) {
          return run(function () {
            person.deleteRecord();
            return person.save();
          });
        }).then(function () {
          equal(callCount, 1, "didDelete called after delete");
        });
      });
    });

    test("an uncommited record also receives a didDelete callback when it is deleted", function () {
      expect(4);

      var callCount = 0;

      var Person = DS.Model.extend({
        bar: DS.attr("string"),
        name: DS.attr("string"),

        didDelete: function () {
          callCount++;
          equal(get(this, "isSaving"), false, "record should not be saving");
          equal(get(this, "hasDirtyAttributes"), false, "record should not be dirty");
        }
      });

      var store = createStore({
        adapter: DS.Adapter.extend(),
        person: Person
      });

      var person;
      run(function () {
        person = store.createRecord("person", { name: "Tomster" });
      });

      equal(callCount, 0, "precond - didDelete callback was not called yet");

      run(function () {
        person.deleteRecord();
      });

      equal(callCount, 1, "didDelete called after delete");
    });

    test("a record receives a becameInvalid callback when it became invalid", function () {
      expect(5);

      var callCount = 0;

      var Person = DS.Model.extend({
        bar: DS.attr("string"),
        name: DS.attr("string"),

        becameInvalid: function () {
          callCount++;

          equal(get(this, "isSaving"), false, "record should not be saving");
          equal(get(this, "hasDirtyAttributes"), true, "record should be dirty");
        }
      });

      var adapter = DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.resolve({ id: 1, name: "Foo" });
        },

        updateRecord: function (store, type, snapshot) {
          equal(callCount, 0, "becameInvalid callback was not called until recordWasInvalid is called");

          return Ember.RSVP.reject(new DS.InvalidError({ bar: "error" }));
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });
      var asyncPerson;

      run(function () {
        asyncPerson = store.findRecord("person", 1);
      });
      equal(callCount, 0, "precond - becameInvalid callback was not called yet");

      // Make sure that the error handler has a chance to attach before
      // save fails.
      run(function () {
        asyncPerson.then(function (person) {
          return run(function () {
            person.set("bar", "Bar");
            return person.save();
          });
        }).then(null, function () {
          equal(callCount, 1, "becameInvalid called after invalidating");
        });
      });
    });

    test("an ID of 0 is allowed", function () {

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var store = createStore({
        person: Person
      });

      run(function () {
        store.push("person", { id: 0, name: "Tom Dale" });
      });

      equal(store.peekAll("person").objectAt(0).get("name"), "Tom Dale", "found record with id 0");
    });
  }
);


define(
  "ember-data/tests/unit/model/merge-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var Person;
    var run = Ember.run;

    module("unit/model/merge - Merging", {
      setup: function () {
        Person = DS.Model.extend({
          name: DS.attr(),
          city: DS.attr()
        });
      }
    });

    test("When a record is in flight, changes can be made", function () {
      expect(3);

      var adapter = DS.Adapter.extend({
        createRecord: function (store, type, snapshot) {
          return Ember.RSVP.resolve({ id: 1, name: "Tom Dale" });
        }
      });
      var person;
      var store = createStore({
        adapter: adapter,
        person: Person
      });

      run(function () {
        person = store.createRecord("person", { name: "Tom Dale" });
      });

      // Make sure saving isn't resolved synchronously
      run(function () {
        var promise = person.save();

        equal(person.get("name"), "Tom Dale");

        person.set("name", "Thomas Dale");

        promise.then(function (person) {
          equal(person.get("hasDirtyAttributes"), true, "The person is still dirty");
          equal(person.get("name"), "Thomas Dale", "The changes made still apply");
        });
      });
    });

    test("Make sure snapshot is created at save time not at flush time", function () {
      expect(5);

      var adapter = DS.Adapter.extend({
        updateRecord: function (store, type, snapshot) {
          equal(snapshot.attr("name"), "Thomas Dale");

          return Ember.RSVP.resolve();
        }
      });

      var store = createStore({ adapter: adapter, person: Person });
      var person;

      run(function () {
        person = store.push("person", { id: 1, name: "Tom" });
        person.set("name", "Thomas Dale");
      });

      run(function () {
        var promise = person.save();

        equal(person.get("name"), "Thomas Dale");

        person.set("name", "Tomasz Dale");

        equal(person.get("name"), "Tomasz Dale", "the local changes applied on top");

        promise.then(async(function (person) {
          equal(person.get("hasDirtyAttributes"), true, "The person is still dirty");
          equal(person.get("name"), "Tomasz Dale", "The local changes apply");
        }));
      });
    });

    test("When a record is in flight, pushes are applied underneath the in flight changes", function () {
      expect(6);

      var adapter = DS.Adapter.extend({
        updateRecord: function (store, type, snapshot) {
          // Make sure saving isn't resolved synchronously
          return new Ember.RSVP.Promise(function (resolve, reject) {
            run.next(null, resolve, { id: 1, name: "Senor Thomas Dale, Esq.", city: "Portland" });
          });
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });
      var person;

      run(function () {
        person = store.push("person", { id: 1, name: "Tom" });
        person.set("name", "Thomas Dale");
      });

      run(function () {
        var promise = person.save();

        equal(person.get("name"), "Thomas Dale");

        person.set("name", "Tomasz Dale");

        store.push("person", { id: 1, name: "Tommy Dale", city: "PDX" });

        equal(person.get("name"), "Tomasz Dale", "the local changes applied on top");
        equal(person.get("city"), "PDX", "the pushed change is available");

        promise.then(async(function (person) {
          equal(person.get("hasDirtyAttributes"), true, "The person is still dirty");
          equal(person.get("name"), "Tomasz Dale", "The local changes apply");
          equal(person.get("city"), "Portland", "The updates from the server apply on top of the previous pushes");
        }));
      });
    });

    test("When a record is dirty, pushes are overridden by local changes", function () {
      var store = createStore({
        adapter: DS.Adapter,
        person: Person
      });
      var person;

      run(function () {
        person = store.push("person", { id: 1, name: "Tom Dale", city: "San Francisco" });
        person.set("name", "Tomasz Dale");
      });

      equal(person.get("hasDirtyAttributes"), true, "the person is currently dirty");
      equal(person.get("name"), "Tomasz Dale", "the update was effective");
      equal(person.get("city"), "San Francisco", "the original data applies");

      run(function () {
        store.push("person", { id: 1, name: "Thomas Dale", city: "Portland" });
      });

      equal(person.get("hasDirtyAttributes"), true, "the local changes are reapplied");
      equal(person.get("name"), "Tomasz Dale", "the local changes are reapplied");
      equal(person.get("city"), "Portland", "if there are no local changes, the new data applied");
    });

    test("When a record is invalid, pushes are overridden by local changes", function () {
      var store = createStore({
        adapter: DS.Adapter,
        person: Person
      });
      var person;

      run(function () {
        person = store.push("person", { id: 1, name: "Brendan McLoughlin", city: "Boston" });
        person.set("name", "Brondan McLoughlin");
        person.send("becameInvalid");
      });

      equal(person.get("hasDirtyAttributes"), true, "the person is currently dirty");
      equal(person.get("isValid"), false, "the person is currently invalid");
      equal(person.get("name"), "Brondan McLoughlin", "the update was effective");
      equal(person.get("city"), "Boston", "the original data applies");

      run(function () {
        store.push("person", { id: 1, name: "bmac", city: "Prague" });
      });

      equal(person.get("hasDirtyAttributes"), true, "the local changes are reapplied");
      equal(person.get("isValid"), false, "record is still invalid");
      equal(person.get("name"), "Brondan McLoughlin", "the local changes are reapplied");
      equal(person.get("city"), "Prague", "if there are no local changes, the new data applied");
    });

    test("A record with no changes can still be saved", function () {
      expect(1);

      var adapter = DS.Adapter.extend({
        updateRecord: function (store, type, snapshot) {
          return Ember.RSVP.resolve({ id: 1, name: "Thomas Dale" });
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });
      var person;

      run(function () {
        person = store.push("person", { id: 1, name: "Tom Dale" });
      });

      run(function () {
        person.save().then(function () {
          equal(person.get("name"), "Thomas Dale", "the updates occurred");
        });
      });
    });

    test("A dirty record can be reloaded", function () {
      expect(3);

      var adapter = DS.Adapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.resolve({ id: 1, name: "Thomas Dale", city: "Portland" });
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });
      var person;

      run(function () {
        person = store.push("person", { id: 1, name: "Tom Dale" });
        person.set("name", "Tomasz Dale");
      });

      run(function () {
        person.reload().then(function () {
          equal(person.get("hasDirtyAttributes"), true, "the person is dirty");
          equal(person.get("name"), "Tomasz Dale", "the local changes remain");
          equal(person.get("city"), "Portland", "the new changes apply");
        });
      });
    });
  }
);


define(
  "ember-data/tests/unit/model/relationships-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var run = Ember.run;
    var Occupation, Person, store;

    module('unit/model/relationships - DS.Model', {
      setup: function () {
        Occupation = DS.Model.extend();

        Person = DS.Model.extend({
          occupations: DS.hasMany('occupation', { async: false }),
          people: DS.hasMany('person', { inverse: 'parent', async: false }),
          parent: DS.belongsTo('person', { inverse: 'people', async: false })
        });

        store = createStore({
          occupation: Occupation,
          person: Person
        });

        Person = store.modelFor('person');
      }
    });

    test('exposes a hash of the relationships on a model', function () {
      var person, occupation;

      run(function () {
        person = store.createRecord('person');
        occupation = store.createRecord('occupation');
      });

      var relationships = get(Person, 'relationships');
      deepEqual(relationships.get('person'), [{ name: 'people', kind: 'hasMany' }, { name: 'parent', kind: 'belongsTo' }]);
      deepEqual(relationships.get('occupation'), [{ name: 'occupations', kind: 'hasMany' }]);
    });

    test('relationshipNames a hash of the relationships on a model with type as a key', function () {
      deepEqual(get(Person, 'relationshipNames'), { hasMany: ['occupations', 'people'], belongsTo: ['parent'] });
    });

    test('eachRelatedType() iterates over relations without duplication', function () {
      var relations = [];

      Person.eachRelatedType(function (modelName) {
        relations.push(modelName);
      });

      deepEqual(relations, ['occupation', 'person']);
    });
  }
);


define(
  "ember-data/tests/unit/model/relationships/belongs-to-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var run = Ember.run;

    module("unit/model/relationships - DS.belongsTo");

    test("belongsTo lazily loads relationships as needed", function () {
      expect(5);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        people: DS.hasMany("person", { async: false })
      });
      Tag.toString = function () {
        return "Tag";
      };

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tag: DS.belongsTo("tag", { async: false })
      });
      Person.toString = function () {
        return "Person";
      };

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      run(function () {
        store.pushMany("tag", [{ id: 5, name: "friendly" }, { id: 2, name: "smarmy" }, { id: 12, name: "oohlala" }]);
        store.push("person", { id: 1, name: "Tom Dale", tag: 5 });
      });

      run(function () {
        store.findRecord("person", 1).then(async(function (person) {
          equal(get(person, "name"), "Tom Dale", "precond - retrieves person record from store");

          equal(get(person, "tag") instanceof Tag, true, "the tag property should return a tag");
          equal(get(person, "tag.name"), "friendly", "the tag shuld have name");

          strictEqual(get(person, "tag"), get(person, "tag"), "the returned object is always the same");
          asyncEqual(get(person, "tag"), store.findRecord("tag", 5), "relationship object is the same as object retrieved directly");
        }));
      });
    });

    test("async belongsTo relationships work when the data hash has not been loaded", function () {
      expect(5);

      var Tag = DS.Model.extend({
        name: DS.attr("string")
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tag: DS.belongsTo("tag", { async: true })
      });

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      env.adapter.findRecord = function (store, type, id, snapshot) {
        if (type === Person) {
          equal(id, 1, "id should be 1");

          return Ember.RSVP.resolve({ id: 1, name: "Tom Dale", tag: 2 });
        } else if (type === Tag) {
          equal(id, 2, "id should be 2");

          return Ember.RSVP.resolve({ id: 2, name: "friendly" });
        }
      };

      run(function () {
        store.findRecord("person", 1).then(async(function (person) {
          equal(get(person, "name"), "Tom Dale", "The person is now populated");

          return run(function () {
            return get(person, "tag");
          });
        })).then(async(function (tag) {
          equal(get(tag, "name"), "friendly", "Tom Dale is now friendly");
          equal(get(tag, "isLoaded"), true, "Tom Dale is now loaded");
        }));
      });
    });

    test("async belongsTo relationships work when the data hash has already been loaded", function () {
      expect(3);

      var Tag = DS.Model.extend({
        name: DS.attr("string")
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tag: DS.belongsTo("tag", { async: true })
      });

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      run(function () {
        store.push("tag", { id: 2, name: "friendly" });
        store.push("person", { id: 1, name: "Tom Dale", tag: 2 });
      });

      run(function () {
        store.findRecord("person", 1).then(async(function (person) {
          equal(get(person, "name"), "Tom Dale", "The person is now populated");
          return run(function () {
            return get(person, "tag");
          });
        })).then(async(function (tag) {
          equal(get(tag, "name"), "friendly", "Tom Dale is now friendly");
          equal(get(tag, "isLoaded"), true, "Tom Dale is now loaded");
        }));
      });
    });

    test("calling createRecord and passing in an undefined value for a relationship should be treated as if null", function () {
      expect(1);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tag: DS.belongsTo("tag", { async: false })
      });

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      run(function () {
        store.createRecord("person", { id: 1, tag: undefined });
      });

      run(function () {
        store.findRecord("person", 1).then(async(function (person) {
          strictEqual(person.get("tag"), null, "undefined values should return null relationships");
        }));
      });
    });

    test("When finding a hasMany relationship the inverse belongsTo relationship is available immediately", function () {
      var Occupation = DS.Model.extend({
        description: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      Occupation.toString = function () {
        return "Occupation";
      };

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        occupations: DS.hasMany("occupation", { async: true })
      });

      Person.toString = function () {
        return "Person";
      };

      var env = setupStore({ occupation: Occupation, person: Person });
      var store = env.store;

      env.adapter.findMany = function (store, type, ids, snapshots) {
        equal(snapshots[0].belongsTo("person").id, "1");
        return Ember.RSVP.resolve([{ id: 5, description: "fifth" }, { id: 2, description: "second" }]);
      };

      env.adapter.coalesceFindRequests = true;

      run(function () {
        store.push("person", { id: 1, name: "Tom Dale", occupations: [5, 2] });
      });

      run(function () {
        store.findRecord("person", 1).then(async(function (person) {
          equal(get(person, "isLoaded"), true, "isLoaded should be true");
          equal(get(person, "name"), "Tom Dale", "the person is still Tom Dale");

          return get(person, "occupations");
        })).then(async(function (occupations) {
          equal(get(occupations, "length"), 2, "the list of occupations should have the correct length");

          equal(get(occupations.objectAt(0), "description"), "fifth", "the occupation is the fifth");
          equal(get(occupations.objectAt(0), "isLoaded"), true, "the occupation is now loaded");
        }));
      });
    });

    test("When finding a belongsTo relationship the inverse belongsTo relationship is available immediately", function () {
      expect(1);

      var Occupation = DS.Model.extend({
        description: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      Occupation.toString = function () {
        return "Occupation";
      };

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        occupation: DS.belongsTo("occupation", { async: true })
      });

      Person.toString = function () {
        return "Person";
      };

      var env = setupStore({ occupation: Occupation, person: Person });
      var store = env.store;

      env.adapter.findRecord = function (store, type, id, snapshot) {
        equal(snapshot.belongsTo("person").id, "1");
        return Ember.RSVP.resolve({ id: 5, description: "fifth" });
      };

      run(function () {
        store.push("person", { id: 1, name: "Tom Dale", occupation: 5 });
      });

      run(function () {
        store.peekRecord("person", 1).get("occupation");
      });
    });

    test("belongsTo supports relationships to models with id 0", function () {
      expect(5);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        people: DS.hasMany("person", { async: false })
      });
      Tag.toString = function () {
        return "Tag";
      };

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tag: DS.belongsTo("tag", { async: false })
      });
      Person.toString = function () {
        return "Person";
      };

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      run(function () {
        store.pushMany("tag", [{ id: 0, name: "friendly" }, { id: 2, name: "smarmy" }, { id: 12, name: "oohlala" }]);
        store.push("person", { id: 1, name: "Tom Dale", tag: 0 });
      });

      run(function () {
        store.findRecord("person", 1).then(async(function (person) {
          equal(get(person, "name"), "Tom Dale", "precond - retrieves person record from store");

          equal(get(person, "tag") instanceof Tag, true, "the tag property should return a tag");
          equal(get(person, "tag.name"), "friendly", "the tag should have name");

          strictEqual(get(person, "tag"), get(person, "tag"), "the returned object is always the same");
          asyncEqual(get(person, "tag"), store.findRecord("tag", 0), "relationship object is the same as object retrieved directly");
        }));
      });
    });

    test("belongsTo gives a warning when provided with a serialize option", function () {
      var Hobby = DS.Model.extend({
        name: DS.attr("string")
      });
      Hobby.toString = function () {
        return "Hobby";
      };

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        hobby: DS.belongsTo("hobby", { serialize: true, async: true })
      });
      Person.toString = function () {
        return "Person";
      };

      var env = setupStore({ hobby: Hobby, person: Person });
      var store = env.store;

      run(function () {
        store.pushMany("hobby", [{ id: 1, name: "fishing" }, { id: 1, name: "coding" }]);
        store.push("person", { id: 1, name: "Tom Dale", hobby: 1 });
      });

      warns(function () {
        run(function () {
          store.find("person", 1).then(async(function (person) {
            get(person, "hobby");
          }));
        });
      }, /You provided a serialize option on the "hobby" property in the "person" class, this belongs in the serializer. See DS.Serializer and it's implementations/);
    });

    test("belongsTo gives a warning when provided with an embedded option", function () {
      var Hobby = DS.Model.extend({
        name: DS.attr("string")
      });
      Hobby.toString = function () {
        return "Hobby";
      };

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        hobby: DS.belongsTo("hobby", { embedded: true, async: true })
      });
      Person.toString = function () {
        return "Person";
      };

      var env = setupStore({ hobby: Hobby, person: Person });
      var store = env.store;

      run(function () {
        store.pushMany("hobby", [{ id: 1, name: "fishing" }, { id: 1, name: "coding" }]);
        store.push("person", { id: 1, name: "Tom Dale", hobby: 1 });
      });

      warns(function () {
        run(function () {
          store.find("person", 1).then(async(function (person) {
            get(person, "hobby");
          }));
        });
      }, /You provided an embedded option on the "hobby" property in the "person" class, this belongs in the serializer. See DS.EmbeddedRecordsMixin/);
    });

    test("DS.belongsTo should be async by default", function () {
      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        people: DS.hasMany("person", { async: false })
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tag: DS.belongsTo("tag")
      });

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      run(function () {
        var person = store.createRecord("person");

        ok(person.get("tag") instanceof DS.PromiseObject, "tag should be an async relationship");
      });
    });
  }
);


define(
  "ember-data/tests/unit/model/relationships/has-many-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var run = Ember.run;
    var env;

    module("unit/model/relationships - DS.hasMany", {
      setup: function () {
        env = setupStore();
      }
    });

    test("hasMany handles pre-loaded relationships", function () {
      expect(13);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      var Pet = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tags: DS.hasMany("tag", { async: false }),
        pets: DS.hasMany("pet", { async: false })
      });

      env.registry.register("model:tag", Tag);
      env.registry.register("model:pet", Pet);
      env.registry.register("model:person", Person);

      env.adapter.findRecord = function (store, type, id, snapshot) {
        if (type === Tag && id === "12") {
          return Ember.RSVP.resolve({ id: 12, name: "oohlala" });
        } else {
          ok(false, "findRecord() should not be called with these values");
        }
      };

      var store = env.store;

      run(function () {
        store.pushMany("tag", [{ id: 5, name: "friendly" }, { id: 2, name: "smarmy" }]);
        store.pushMany("pet", [{ id: 4, name: "fluffy" }, { id: 7, name: "snowy" }, { id: 12, name: "cerberus" }]);
        store.push("person", { id: 1, name: "Tom Dale", tags: [5] });
        store.push("person", { id: 2, name: "Yehuda Katz", tags: [12] });
      });

      run(function () {
        store.findRecord("person", 1).then(function (person) {
          equal(get(person, "name"), "Tom Dale", "precond - retrieves person record from store");

          var tags = get(person, "tags");
          equal(get(tags, "length"), 1, "the list of tags should have the correct length");
          equal(get(tags.objectAt(0), "name"), "friendly", "the first tag should be a Tag");

          run(function () {
            store.push("person", { id: 1, name: "Tom Dale", tags: [5, 2] });
          });

          equal(tags, get(person, "tags"), "a relationship returns the same object every time");
          equal(get(get(person, "tags"), "length"), 2, "the length is updated after new data is loaded");

          strictEqual(get(person, "tags").objectAt(0), get(person, "tags").objectAt(0), "the returned object is always the same");
          asyncEqual(get(person, "tags").objectAt(0), store.findRecord("tag", 5), "relationship objects are the same as objects retrieved directly");

          run(function () {
            store.push("person", { id: 3, name: "KSelden" });
          });

          return store.findRecord("person", 3);
        }).then(function (kselden) {
          equal(get(get(kselden, "tags"), "length"), 0, "a relationship that has not been supplied returns an empty array");

          run(function () {
            store.push("person", { id: 4, name: "Cyvid Hamluck", pets: [4] });
          });
          return store.findRecord("person", 4);
        }).then(function (cyvid) {
          equal(get(cyvid, "name"), "Cyvid Hamluck", "precond - retrieves person record from store");

          var pets = get(cyvid, "pets");
          equal(get(pets, "length"), 1, "the list of pets should have the correct length");
          equal(get(pets.objectAt(0), "name"), "fluffy", "the first pet should be correct");

          run(function () {
            store.push("person", { id: 4, name: "Cyvid Hamluck", pets: [4, 12] });
          });

          equal(pets, get(cyvid, "pets"), "a relationship returns the same object every time");
          equal(get(get(cyvid, "pets"), "length"), 2, "the length is updated after new data is loaded");
        });
      });
    });

    test("hasMany lazily loads async relationships", function () {
      expect(5);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      var Pet = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tags: DS.hasMany("tag", { async: true }),
        pets: DS.hasMany("pet", { async: false })
      });

      env.registry.register("model:tag", Tag);
      env.registry.register("model:pet", Pet);
      env.registry.register("model:person", Person);

      env.adapter.findRecord = function (store, type, id, snapshot) {
        if (type === Tag && id === "12") {
          return Ember.RSVP.resolve({ id: 12, name: "oohlala" });
        } else {
          ok(false, "findRecord() should not be called with these values");
        }
      };

      var store = env.store;

      run(function () {
        store.pushMany("tag", [{ id: 5, name: "friendly" }, { id: 2, name: "smarmy" }]);
        store.pushMany("pet", [{ id: 4, name: "fluffy" }, { id: 7, name: "snowy" }, { id: 12, name: "cerberus" }]);
        store.push("person", { id: 1, name: "Tom Dale", tags: [5] });
        store.push("person", { id: 2, name: "Yehuda Katz", tags: [12] });
      });

      var wycats;

      run(function () {
        store.findRecord("person", 2).then(function (person) {
          wycats = person;

          equal(get(wycats, "name"), "Yehuda Katz", "precond - retrieves person record from store");

          return Ember.RSVP.hash({
            wycats: wycats,
            tags: wycats.get("tags")
          });
        }).then(function (records) {
          equal(get(records.tags, "length"), 1, "the list of tags should have the correct length");
          equal(get(records.tags.objectAt(0), "name"), "oohlala", "the first tag should be a Tag");

          strictEqual(records.tags.objectAt(0), records.tags.objectAt(0), "the returned object is always the same");
          asyncEqual(records.tags.objectAt(0), store.findRecord("tag", 12), "relationship objects are the same as objects retrieved directly");

          return get(wycats, "tags");
        }).then(function (tags) {
          var newTag;
          run(function () {
            newTag = store.createRecord("tag");
            tags.pushObject(newTag);
          });
        });
      });
    });

    test("should be able to retrieve the type for a hasMany relationship without specifying a type from its metadata", function () {
      var Tag = DS.Model.extend({});

      var Person = DS.Model.extend({
        tags: DS.hasMany("tag", { async: false })

      });

      var env = setupStore({
        tag: Tag,
        person: Person
      });

      equal(env.store.modelFor("person").typeForRelationship("tags", env.store), Tag, "returns the relationship type");
    });

    test("should be able to retrieve the type for a hasMany relationship specified using a string from its metadata", function () {
      var Tag = DS.Model.extend({});

      var Person = DS.Model.extend({
        tags: DS.hasMany("tag", { async: false })
      });

      var env = setupStore({
        tag: Tag,
        person: Person
      });

      equal(env.store.modelFor("person").typeForRelationship("tags", env.store), Tag, "returns the relationship type");
    });

    test("should be able to retrieve the type for a belongsTo relationship without specifying a type from its metadata", function () {
      var Tag = DS.Model.extend({});

      var Person = DS.Model.extend({
        tag: DS.belongsTo("tag", { async: false })
      });

      var env = setupStore({
        tag: Tag,
        person: Person
      });

      equal(env.store.modelFor("person").typeForRelationship("tag", env.store), Tag, "returns the relationship type");
    });

    test("should be able to retrieve the type for a belongsTo relationship specified using a string from its metadata", function () {
      var Tag = DS.Model.extend({
        name: DS.attr("string")
      });

      var Person = DS.Model.extend({
        tags: DS.belongsTo("tag", { async: false })
      });

      var env = setupStore({
        tag: Tag,
        person: Person
      });

      equal(env.store.modelFor("person").typeForRelationship("tags", env.store), Tag, "returns the relationship type");
    });

    test("relationships work when declared with a string path", function () {
      expect(2);

      window.App = {};

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tags: DS.hasMany("tag", { async: false })
      });

      var Tag = DS.Model.extend({
        name: DS.attr("string")
      });

      var env = setupStore({
        person: Person,
        tag: Tag
      });

      run(function () {
        env.store.pushMany("tag", [{ id: 5, name: "friendly" }, { id: 2, name: "smarmy" }, { id: 12, name: "oohlala" }]);
        env.store.push("person", { id: 1, name: "Tom Dale", tags: [5, 2] });
      });

      run(function () {
        env.store.findRecord("person", 1).then(function (person) {
          equal(get(person, "name"), "Tom Dale", "precond - retrieves person record from store");
          equal(get(person, "tags.length"), 2, "the list of tags should have the correct length");
        });
      });
    });

    test("hasMany relationships work when the data hash has not been loaded", function () {
      expect(8);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      Tag.toString = function () {
        return "Tag";
      };

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tags: DS.hasMany("tag", { async: true })
      });

      Person.toString = function () {
        return "Person";
      };

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      env.adapter.coalesceFindRequests = true;
      env.adapter.findMany = function (store, type, ids, snapshots) {
        equal(type, Tag, "type should be Tag");
        deepEqual(ids, ["5", "2"], "ids should be 5 and 2");

        return Ember.RSVP.resolve([{ id: 5, name: "friendly" }, { id: 2, name: "smarmy" }]);
      };

      env.adapter.findRecord = function (store, type, id, snapshot) {
        equal(type, Person, "type should be Person");
        equal(id, 1, "id should be 1");

        return Ember.RSVP.resolve({ id: 1, name: "Tom Dale", tags: [5, 2] });
      };

      run(function () {
        store.findRecord("person", 1).then(function (person) {
          equal(get(person, "name"), "Tom Dale", "The person is now populated");

          return run(function () {
            return person.get("tags");
          });
        }).then(function (tags) {
          equal(get(tags, "length"), 2, "the tags object still exists");
          equal(get(tags.objectAt(0), "name"), "friendly", "Tom Dale is now friendly");
          equal(get(tags.objectAt(0), "isLoaded"), true, "Tom Dale is now loaded");
        });
      });
    });

    test("it is possible to add a new item to a relationship", function () {
      expect(2);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        people: DS.belongsTo("person", { async: false })
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tags: DS.hasMany("tag", { async: false })
      });

      var env = setupStore({
        tag: Tag,
        person: Person
      });

      var store = env.store;

      run(function () {
        store.push("person", { id: 1, name: "Tom Dale", tags: [1] });
        store.push("tag", { id: 1, name: "ember" });
      });

      run(function () {
        store.findRecord("person", 1).then(function (person) {
          var tag = get(person, "tags").objectAt(0);

          equal(get(tag, "name"), "ember", "precond - relationships work");

          tag = store.createRecord("tag", { name: "js" });
          get(person, "tags").pushObject(tag);

          equal(get(person, "tags").objectAt(1), tag, "newly added relationship works");
        });
      });
    });

    test("possible to replace items in a relationship using setObjects w/ Ember Enumerable Array/Object as the argument (GH-2533)", function () {
      expect(2);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tags: DS.hasMany("tag", { async: false })
      });

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      run(function () {
        store.push("person", { id: 1, name: "Tom Dale", tags: [1] });
        store.push("person", { id: 2, name: "Sylvain Mina", tags: [2] });
        store.push("tag", { id: 1, name: "ember" });
        store.push("tag", { id: 2, name: "ember-data" });
      });

      var tom, sylvain;

      run(function () {
        tom = store.peekRecord("person", "1");
        sylvain = store.peekRecord("person", "2");
        // Test that since sylvain.get('tags') instanceof DS.ManyArray,
        // addRecords on Relationship iterates correctly.
        tom.get("tags").setObjects(sylvain.get("tags"));
      });

      equal(tom.get("tags.length"), 1);
      equal(tom.get("tags.firstObject"), store.peekRecord("tag", 2));
    });

    test("it is possible to remove an item from a relationship", function () {
      expect(2);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tags: DS.hasMany("tag", { async: false })
      });

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      run(function () {
        store.push("person", { id: 1, name: "Tom Dale", tags: [1] });
        store.push("tag", { id: 1, name: "ember" });
      });

      run(function () {
        store.findRecord("person", 1).then(async(function (person) {
          var tag = get(person, "tags").objectAt(0);

          equal(get(tag, "name"), "ember", "precond - relationships work");

          run(function () {
            get(person, "tags").removeObject(tag);
          });

          equal(get(person, "tags.length"), 0, "object is removed from the relationship");
        }));
      });
    });

    test("it is possible to add an item to a relationship, remove it, then add it again", function () {
      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tags: DS.hasMany("tag", { async: false })
      });

      Tag.toString = function () {
        return "Tag";
      };
      Person.toString = function () {
        return "Person";
      };

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;
      var person, tag1, tag2, tag3;

      run(function () {
        person = store.createRecord("person");
        tag1 = store.createRecord("tag");
        tag2 = store.createRecord("tag");
        tag3 = store.createRecord("tag");
      });

      var tags = get(person, "tags");

      run(function () {
        tags.pushObjects([tag1, tag2, tag3]);
        tags.removeObject(tag2);
      });

      equal(tags.objectAt(0), tag1);
      equal(tags.objectAt(1), tag3);
      equal(get(person, "tags.length"), 2, "object is removed from the relationship");

      run(function () {
        tags.insertAt(0, tag2);
      });

      equal(get(person, "tags.length"), 3, "object is added back to the relationship");
      equal(tags.objectAt(0), tag2);
      equal(tags.objectAt(1), tag1);
      equal(tags.objectAt(2), tag3);
    });

    test("DS.hasMany is async by default", function () {
      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        people: DS.hasMany("person")
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tag: DS.belongsTo("tag", { async: false })
      });

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      run(function () {
        var tag = store.createRecord("tag");
        ok(tag.get("people") instanceof DS.PromiseArray, "people should be an async relationship");
      });
    });
  }
);


define(
  "ember-data/tests/unit/model/relationships/record-array-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var set = Ember.set;
    var run = Ember.run;

    module("unit/model/relationships - RecordArray");

    test("updating the content of a RecordArray updates its content", function () {
      var Tag = DS.Model.extend({
        name: DS.attr("string")
      });

      var env = setupStore({ tag: Tag });
      var store = env.store;
      var records, tags, internalModel;

      run(function () {
        records = store.pushMany("tag", [{ id: 5, name: "friendly" }, { id: 2, name: "smarmy" }, { id: 12, name: "oohlala" }]);
        internalModel = Ember.A(records).mapBy("_internalModel");
        tags = DS.RecordArray.create({ content: Ember.A(internalModel.slice(0, 2)), store: store, type: Tag });
      });

      var tag = tags.objectAt(0);
      equal(get(tag, "name"), "friendly", "precond - we're working with the right tags");

      run(function () {
        set(tags, "content", Ember.A(internalModel.slice(1, 3)));
      });

      tag = tags.objectAt(0);
      equal(get(tag, "name"), "smarmy", "the lookup was updated");
    });

    test("can create child record from a hasMany relationship", function () {
      expect(3);

      var Tag = DS.Model.extend({
        name: DS.attr("string"),
        person: DS.belongsTo("person", { async: false })
      });

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        tags: DS.hasMany("tag", { async: false })
      });

      var env = setupStore({ tag: Tag, person: Person });
      var store = env.store;

      run(function () {
        store.push("person", { id: 1, name: "Tom Dale" });
      });

      run(function () {
        store.findRecord("person", 1).then(async(function (person) {
          person.get("tags").createRecord({ name: "cool" });

          equal(get(person, "name"), "Tom Dale", "precond - retrieves person record from store");
          equal(get(person, "tags.length"), 1, "tag is added to the parent record");
          equal(get(person, "tags").objectAt(0).get("name"), "cool", "tag values are passed along");
        }));
      });
    });
  }
);


define(
  "ember-data/tests/unit/model/rollback-attributes-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, Person, Dog;
    var run = Ember.run;

    module("unit/model/rollbackAttributes - model.rollbackAttributes()", {
      setup: function () {
        Person = DS.Model.extend({
          firstName: DS.attr(),
          lastName: DS.attr()
        });

        env = setupStore({ person: Person });
        store = env.store;
      }
    });

    test("changes to attributes can be rolled back", function () {
      var person;
      run(function () {
        person = store.push("person", { id: 1, firstName: "Tom", lastName: "Dale" });
        person.set("firstName", "Thomas");
      });

      equal(person.get("firstName"), "Thomas");

      run(function () {
        person.rollbackAttributes();
      });

      equal(person.get("firstName"), "Tom");
      equal(person.get("hasDirtyAttributes"), false);
    });

    test("changes to unassigned attributes can be rolled back", function () {
      var person;
      run(function () {
        person = store.push("person", { id: 1, lastName: "Dale" });
        person.set("firstName", "Thomas");
      });

      equal(person.get("firstName"), "Thomas");

      run(function () {
        person.rollbackAttributes();
      });

      equal(person.get("firstName"), undefined);
      equal(person.get("hasDirtyAttributes"), false);
    });

    test("changes to attributes made after a record is in-flight only rolls back the local changes", function () {
      env.adapter.updateRecord = function (store, type, snapshot) {
        // Make sure the save is async
        return new Ember.RSVP.Promise(function (resolve, reject) {
          Ember.run.later(null, resolve, 15);
        });
      };
      var person;

      run(function () {
        person = store.push("person", { id: 1, firstName: "Tom", lastName: "Dale" });
        person.set("firstName", "Thomas");
      });

      Ember.run(function () {
        var saving = person.save();

        equal(person.get("firstName"), "Thomas");

        person.set("lastName", "Dolly");

        equal(person.get("lastName"), "Dolly");

        person.rollbackAttributes();

        equal(person.get("firstName"), "Thomas");
        equal(person.get("lastName"), "Dale");
        equal(person.get("isSaving"), true);

        saving.then(async(function () {
          equal(person.get("hasDirtyAttributes"), false, "The person is now clean");
        }));
      });
    });

    test("a record's changes can be made if it fails to save", function () {
      env.adapter.updateRecord = function (store, type, snapshot) {
        return Ember.RSVP.reject();
      };
      var person;

      run(function () {
        person = store.push("person", { id: 1, firstName: "Tom", lastName: "Dale" });
        person.set("firstName", "Thomas");
      });

      deepEqual(person.changedAttributes().firstName, ["Tom", "Thomas"]);

      run(function () {
        person.save().then(null, function () {
          equal(person.get("isError"), true);
          deepEqual(person.changedAttributes().firstName, ["Tom", "Thomas"]);

          person.rollbackAttributes();

          equal(person.get("firstName"), "Tom");
          equal(person.get("isError"), false);
          equal(Object.keys(person.changedAttributes()).length, 0);
        });
      });
    });

    test("a deleted record's attributes can be rollbacked if it fails to save, record arrays are updated accordingly", function () {
      expect(7);
      env.adapter.deleteRecord = function (store, type, snapshot) {
        return Ember.RSVP.reject();
      };
      var person, people;

      run(function () {
        person = store.push("person", { id: 1, firstName: "Tom", lastName: "Dale" });
        people = store.peekAll("person");
      });

      run(function () {
        person.deleteRecord();
      });
      equal(people.get("length"), 0, "a deleted record does not appear in record array anymore");
      equal(people.objectAt(0), null, "a deleted record does not appear in record array anymore");

      run(function () {
        person.save().then(null, function () {
          equal(person.get("isError"), true);
          equal(person.get("isDeleted"), true);
          run(function () {
            person.rollbackAttributes();
          });
          equal(person.get("isDeleted"), false);
          equal(person.get("isError"), false);
        }).then(function () {
          equal(people.get("length"), 1, "the underlying record array is updated accordingly in an asynchronous way");
        });
      });
    });

    test("new record's attributes can be rollbacked", function () {
      var person;

      run(function () {
        person = store.createRecord("person", { id: 1 });
      });

      equal(person.get("isNew"), true, "must be new");
      equal(person.get("hasDirtyAttributes"), true, "must be dirty");

      Ember.run(person, "rollbackAttributes");

      equal(person.get("isNew"), false, "must not be new");
      equal(person.get("hasDirtyAttributes"), false, "must not be dirty");
      equal(person.get("isDeleted"), true, "must be deleted");
    });

    test("invalid new record's attributes can be rollbacked", function () {
      var person;
      var adapter = DS.RESTAdapter.extend({
        ajax: function (url, type, hash) {
          var adapter = this;

          return new Ember.RSVP.Promise(function (resolve, reject) {
            /* If InvalidError is passed back in the reject it will throw the
               exception which will bubble up the call stack (crashing the test)
               instead of hitting the failure route of the promise.
               So wrapping the reject in an Ember.run.next makes it so save
               completes without failure and the failure hits the failure route
               of the promise instead of crashing the save. */
            Ember.run.next(function () {
              reject(adapter.ajaxError({ name: "is invalid" }));
            });
          });
        },

        ajaxError: function (jqXHR) {
          return new DS.InvalidError(jqXHR);
        }
      });

      env = setupStore({ person: Person, adapter: adapter });

      run(function () {
        person = env.store.createRecord("person", { id: 1 });
      });

      equal(person.get("isNew"), true, "must be new");
      equal(person.get("hasDirtyAttributes"), true, "must be dirty");

      run(function () {
        person.save().then(null, async(function () {
          equal(person.get("isValid"), false);
          person.rollbackAttributes();

          equal(person.get("isNew"), false, "must not be new");
          equal(person.get("hasDirtyAttributes"), false, "must not be dirty");
          equal(person.get("isDeleted"), true, "must be deleted");
        }));
      });
    });

    test("deleted record's attributes can be rollbacked", function () {
      var person, people;

      run(function () {
        person = store.push("person", { id: 1 });
        people = store.peekAll("person");
        person.deleteRecord();
      });

      equal(people.get("length"), 0, "a deleted record does not appear in record array anymore");
      equal(people.objectAt(0), null, "a deleted record does not appear in record array anymore");

      equal(person.get("isDeleted"), true, "must be deleted");

      run(function () {
        person.rollbackAttributes();
      });
      equal(people.get("length"), 1, "the rollbacked record should appear again in the record array");
      equal(person.get("isDeleted"), false, "must not be deleted");
      equal(person.get("hasDirtyAttributes"), false, "must not be dirty");
    });

    test("invalid record's attributes can be rollbacked", function () {
      Dog = DS.Model.extend({
        name: DS.attr()
      });

      var adapter = DS.RESTAdapter.extend({
        ajax: function (url, type, hash) {
          var adapter = this;

          return new Ember.RSVP.Promise(function (resolve, reject) {
            /* If InvalidError is passed back in the reject it will throw the
               exception which will bubble up the call stack (crashing the test)
               instead of hitting the failure route of the promise.
               So wrapping the reject in an Ember.run.next makes it so save
               completes without failure and the failure hits the failure route
               of the promise instead of crashing the save. */
            Ember.run.next(function () {
              reject(adapter.ajaxError({ name: "is invalid" }));
            });
          });
        },

        ajaxError: function (jqXHR) {
          return new DS.InvalidError(jqXHR);
        }
      });

      env = setupStore({ dog: Dog, adapter: adapter });
      var dog;
      run(function () {
        dog = env.store.push("dog", { id: 1, name: "Pluto" });
        dog.set("name", "is a dwarf planet");
      });

      run(function () {
        dog.save().then(null, async(function () {
          dog.rollbackAttributes();

          equal(dog.get("name"), "Pluto");
          ok(dog.get("isValid"));
        }));
      });
    });

    test("invalid record's attributes rolled back to correct state after set", function () {
      Dog = DS.Model.extend({
        name: DS.attr(),
        breed: DS.attr()
      });

      var adapter = DS.RESTAdapter.extend({
        ajax: function (url, type, hash) {
          var adapter = this;

          return new Ember.RSVP.Promise(function (resolve, reject) {
            /* If InvalidError is passed back in the reject it will throw the
               exception which will bubble up the call stack (crashing the test)
               instead of hitting the failure route of the promise.
               So wrapping the reject in an Ember.run.next makes it so save
               completes without failure and the failure hits the failure route
               of the promise instead of crashing the save. */
            Ember.run.next(function () {
              reject(adapter.ajaxError({ name: "is invalid" }));
            });
          });
        },

        ajaxError: function (jqXHR) {
          return new Error(jqXHR);
        }
      });

      env = setupStore({ dog: Dog, adapter: adapter });
      var dog;
      run(function () {
        dog = env.store.push("dog", { id: 1, name: "Pluto", breed: "Disney" });
        dog.set("name", "is a dwarf planet");
        dog.set("breed", "planet");
      });

      run(function () {
        dog.save().then(null, async(function () {
          equal(dog.get("name"), "is a dwarf planet");
          equal(dog.get("breed"), "planet");

          run(function () {
            dog.set("name", "Seymour Asses");
          });

          equal(dog.get("name"), "Seymour Asses");
          equal(dog.get("breed"), "planet");

          run(function () {
            dog.rollbackAttributes();
          });

          equal(dog.get("name"), "Pluto");
          equal(dog.get("breed"), "Disney");
          ok(dog.get("isValid"));
        }));
      });
    });

    test("when destroying a record setup the record state to invalid, the record's attributes can be rollbacked", function () {
      Dog = DS.Model.extend({
        name: DS.attr()
      });

      var adapter = DS.RESTAdapter.extend({
        ajax: function (url, type, hash) {
          var adapter = this;

          return new Ember.RSVP.Promise(function (resolve, reject) {
            Ember.run.next(function () {
              reject(adapter.ajaxError({ name: "is invalid" }));
            });
          });
        },

        ajaxError: function (jqXHR) {
          return new DS.InvalidError(jqXHR);
        }
      });

      env = setupStore({ dog: Dog, adapter: adapter });
      var dog;
      run(function () {
        dog = env.store.push("dog", { id: 1, name: "Pluto" });
      });

      run(function () {
        dog.destroyRecord().then(null, async(function () {

          equal(dog.get("isError"), false, "must not be error");
          equal(dog.get("isDeleted"), true, "must be deleted");
          equal(dog.get("isValid"), false, "must not be valid");
          ok(dog.get("errors.length") > 0, "must have errors");

          dog.rollbackAttributes();

          equal(dog.get("isError"), false, "must not be error after `rollbackAttributes`");
          equal(dog.get("isDeleted"), false, "must not be deleted after `rollbackAttributes`");
          equal(dog.get("isValid"), true, "must be valid after `rollbackAttributes`");
          ok(dog.get("errors.length") === 0, "must not have errors");
        }));
      });
    });
  }
);


define(
  "ember-data/tests/unit/promise-proxies-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    module('PromiseManyArray');

    test('.reload should NOT leak the internal promise, rather return another promiseArray', function () {
      expect(2);

      var content = Ember.A();

      content.reload = function () {
        return Ember.RSVP.Promise.resolve(content);
      };

      var array = DS.PromiseManyArray.create({
        content: content
      });

      Ember.run(function () {
        var reloaded = array.reload();

        ok(reloaded instanceof DS.PromiseManyArray);

        reloaded.then(function (value) {
          equal(content, value);
        });
      });
    });
  }
);


define(
  "ember-data/tests/unit/record-array-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;

    var Person, array;
    var run = Ember.run;

    module("unit/record_array - DS.RecordArray", {
      setup: function () {
        array = [{ id: "1", name: "Scumbag Dale" }, { id: "2", name: "Scumbag Katz" }, { id: "3", name: "Scumbag Bryn" }];

        Person = DS.Model.extend({
          name: DS.attr("string")
        });
      }
    });

    test("a record array is backed by records", function () {
      expect(3);

      var store = createStore({
        person: Person
      });
      run(function () {
        store.pushMany("person", array);
      });

      run(function () {
        store.findByIds("person", [1, 2, 3]).then(function (records) {
          for (var i = 0, l = get(array, "length"); i < l; i++) {
            deepEqual(records[i].getProperties("id", "name"), array[i], "a record array materializes objects on demand");
          }
        });
      });
    });

    test("acts as a live query", function () {

      var store = createStore({
        person: Person
      });
      var recordArray = store.peekAll("person");
      run(function () {
        store.push("person", { id: 1, name: "wycats" });
      });
      equal(get(recordArray, "lastObject.name"), "wycats");

      run(function () {
        store.push("person", { id: 2, name: "brohuda" });
      });
      equal(get(recordArray, "lastObject.name"), "brohuda");
    });

    test("stops updating when destroyed", function () {
      expect(3);

      var store = createStore({
        person: Person
      });
      // TODO remove once
      // https://github.com/emberjs/ember.js/commit/c3f13e85a62069295965dd49ca487fe6ddba1188
      // is on the release branch
      var emptyLength = Ember.meta(store).descs ? undefined : 0;

      var recordArray = store.peekAll("person");
      run(function () {
        store.push("person", { id: 1, name: "wycats" });
      });

      run(function () {
        recordArray.destroy();
      });

      run(function () {
        equal(recordArray.get("length"), emptyLength, "Has no more records");
        store.push("person", { id: 2, name: "brohuda" });
      });

      equal(recordArray.get("length"), emptyLength, "Has not been updated");
      equal(recordArray.get("content"), undefined, "Has not been updated");
    });

    test("a loaded record is removed from a record array when it is deleted", function () {
      expect(4);

      var Tag = DS.Model.extend({
        people: DS.hasMany("person", { async: false })
      });

      Person.reopen({
        tag: DS.belongsTo("tag", { async: false })
      });

      var env = setupStore({
        tag: Tag,
        person: Person
      });
      var store = env.store;

      run(function () {
        store.pushMany("person", array);
        store.push("tag", { id: 1 });
      });

      run(function () {
        var asyncRecords = Ember.RSVP.hash({
          scumbag: store.findRecord("person", 1),
          tag: store.findRecord("tag", 1)
        });

        asyncRecords.then(function (records) {
          var scumbag = records.scumbag;
          var tag = records.tag;

          run(function () {
            tag.get("people").addObject(scumbag);
          });
          equal(get(scumbag, "tag"), tag, "precond - the scumbag's tag has been set");

          var recordArray = tag.get("people");

          equal(get(recordArray, "length"), 1, "precond - record array has one item");
          equal(get(recordArray.objectAt(0), "name"), "Scumbag Dale", "item at index 0 is record with id 1");

          scumbag.deleteRecord();

          equal(get(recordArray, "length"), 0, "record is removed from the record array");
        });
      });
    });

    test("a loaded record is removed from a record array when it is deleted even if the belongsTo side isn't defined", function () {
      var Tag = DS.Model.extend({
        people: DS.hasMany("person", { async: false })
      });

      var env = setupStore({
        tag: Tag,
        person: Person
      });
      var store = env.store;
      var scumbag, tag;

      run(function () {
        scumbag = store.push("person", { id: 1, name: "Scumbag Tom" });
        tag = store.push("tag", { id: 1, people: [1] });
        scumbag.deleteRecord();
      });

      equal(tag.get("people.length"), 0, "record is removed from the record array");
    });

    test("a loaded record is removed both from the record array and from the belongs to, even if the belongsTo side isn't defined", function () {
      var Tag = DS.Model.extend({
        people: DS.hasMany("person", { async: false })
      });

      var Tool = DS.Model.extend({
        person: DS.belongsTo("person", { async: false })
      });

      var env = setupStore({
        tag: Tag,
        person: Person,
        tool: Tool
      });
      var store = env.store;
      var scumbag, tag, tool;

      run(function () {
        scumbag = store.push("person", { id: 1, name: "Scumbag Tom" });
        tag = store.push("tag", { id: 1, people: [1] });
        tool = store.push("tool", { id: 1, person: 1 });
      });

      equal(tag.get("people.length"), 1, "record is in the record array");
      equal(tool.get("person"), scumbag, "the tool belongs to the record");

      run(function () {
        scumbag.deleteRecord();
      });

      equal(tag.get("people.length"), 0, "record is removed from the record array");
      equal(tool.get("person"), null, "the tool is now orphan");
    });

    // GitHub Issue #168
    test("a newly created record is removed from a record array when it is deleted", function () {
      var store = createStore({
        person: Person
      });
      var recordArray = store.peekAll("person");
      var scumbag;

      run(function () {
        scumbag = store.createRecord("person", {
          name: "Scumbag Dale"
        });
      });

      equal(get(recordArray, "length"), 1, "precond - record array already has the first created item");

      // guarantee coalescence
      Ember.run(function () {
        store.createRecord("person", { name: "p1" });
        store.createRecord("person", { name: "p2" });
        store.createRecord("person", { name: "p3" });
      });

      equal(get(recordArray, "length"), 4, "precond - record array has the created item");
      equal(get(recordArray.objectAt(0), "name"), "Scumbag Dale", "item at index 0 is record with id 1");

      run(function () {
        scumbag.deleteRecord();
      });

      equal(get(recordArray, "length"), 3, "record is removed from the record array");

      run(function () {
        recordArray.objectAt(0).set("name", "toto");
      });

      equal(get(recordArray, "length"), 3, "record is still removed from the record array");
    });

    test("a record array returns undefined when asking for a member outside of its content Array's range", function () {
      var store = createStore({
        person: Person
      });

      run(function () {
        store.pushMany("person", array);
      });

      var recordArray = store.peekAll("person");

      strictEqual(recordArray.objectAt(20), undefined, "objects outside of the range just return undefined");
    });

    // This tests for a bug in the recordCache, where the records were being cached in the incorrect order.
    test("a record array should be able to be enumerated in any order", function () {
      var store = createStore({
        person: Person
      });
      run(function () {
        store.pushMany("person", array);
      });

      var recordArray = store.peekAll("person");

      equal(get(recordArray.objectAt(2), "id"), 3, "should retrieve correct record at index 2");
      equal(get(recordArray.objectAt(1), "id"), 2, "should retrieve correct record at index 1");
      equal(get(recordArray.objectAt(0), "id"), 1, "should retrieve correct record at index 0");
    });

    test("an AdapterPopulatedRecordArray knows if it's loaded or not", function () {
      expect(1);

      var env = setupStore({ person: Person });
      var store = env.store;

      env.adapter.query = function (store, type, query, recordArray) {
        return Ember.RSVP.resolve(array);
      };

      run(function () {
        store.query("person", { page: 1 }).then(function (people) {
          equal(get(people, "isLoaded"), true, "The array is now loaded");
        });
      });
    });

    test("a record array should return a promise when updating", function () {
      var recordArray, promise;
      var env = setupStore({ person: Person });
      var store = env.store;

      env.adapter.findAll = function (store, type, query, recordArray) {
        return Ember.RSVP.resolve(array);
      };

      recordArray = store.peekAll("person");
      run(function () {
        promise = recordArray.update();
      });
      ok(promise.then && typeof promise.then === "function", "#update returns a promise");
    });
  }
);


define(
  "ember-data/tests/unit/record-arrays/filtered-record-array-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var filteredArray;

    module('unit/record-arrays/filtered-record-array - DS.FilteredRecordArray', {
      setup: function () {
        filteredArray = DS.FilteredRecordArray.create({ type: 'recordType' });
      }
    });

    test('recordArray.replace() throws error', function () {
      throws(function () {
        filteredArray.replace();
      }, Error('The result of a client-side filter (on recordType) is immutable.'), 'throws error');
    });
  }
);


define("ember-data/tests/unit/states-test", ["exports"], function(__exports__) {
  "use strict";

  function __es6_export__(name, value) {
    __exports__[name] = value;
  }

  var get = Ember.get;

  var rootState, stateName;

  module("unit/states - Flags for record states", {
    setup: function () {
      rootState = DS.RootState;
    }
  });

  var isTrue = function (flag) {
    equal(get(rootState, stateName + "." + flag), true, stateName + "." + flag + " should be true");
  };

  var isFalse = function (flag) {
    equal(get(rootState, stateName + "." + flag), false, stateName + "." + flag + " should be false");
  };

  test("the empty state", function () {
    stateName = "empty";
    isFalse("isLoading");
    isFalse("isLoaded");
    isFalse("isDirty");
    isFalse("isSaving");
    isFalse("isDeleted");
  });

  test("the loading state", function () {
    stateName = "loading";
    isTrue("isLoading");
    isFalse("isLoaded");
    isFalse("isDirty");
    isFalse("isSaving");
    isFalse("isDeleted");
  });

  test("the loaded state", function () {
    stateName = "loaded";
    isFalse("isLoading");
    isTrue("isLoaded");
    isFalse("isDirty");
    isFalse("isSaving");
    isFalse("isDeleted");
  });

  test("the updated state", function () {
    stateName = "loaded.updated";
    isFalse("isLoading");
    isTrue("isLoaded");
    isTrue("isDirty");
    isFalse("isSaving");
    isFalse("isDeleted");
  });

  test("the saving state", function () {
    stateName = "loaded.updated.inFlight";
    isFalse("isLoading");
    isTrue("isLoaded");
    isTrue("isDirty");
    isTrue("isSaving");
    isFalse("isDeleted");
  });

  test("the deleted state", function () {
    stateName = "deleted";
    isFalse("isLoading");
    isTrue("isLoaded");
    isTrue("isDirty");
    isFalse("isSaving");
    isTrue("isDeleted");
  });

  test("the deleted.saving state", function () {
    stateName = "deleted.inFlight";
    isFalse("isLoading");
    isTrue("isLoaded");
    isTrue("isDirty");
    isTrue("isSaving");
    isTrue("isDeleted");
  });

  test("the deleted.saved state", function () {
    stateName = "deleted.saved";
    isFalse("isLoading");
    isTrue("isLoaded");
    isFalse("isDirty");
    isFalse("isSaving");
    isTrue("isDeleted");
  });
});


define(
  "ember-data/tests/unit/store/adapter-interop-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var set = Ember.set;
    var resolve = Ember.RSVP.resolve;
    var TestAdapter, store, person;
    var run = Ember.run;

    module("unit/store/adapter_interop - DS.Store working with a DS.Adapter", {
      setup: function () {
        TestAdapter = DS.Adapter.extend();
      },
      teardown: function () {
        run(function () {
          if (store) {
            store.destroy();
          }
        });
      }
    });

    test("Adapter can be set as a factory", function () {
      store = createStore({ adapter: TestAdapter });

      ok(store.get("defaultAdapter") instanceof TestAdapter);
    });

    test("Adapter can be set as a name", function () {
      store = createStore({ adapter: "-rest" });

      ok(store.get("defaultAdapter") instanceof DS.RESTAdapter);
    });

    test("Adapter can not be set as an instance", function () {
      expect(1);

      store = DS.Store.create({
        adapter: DS.Adapter.create()
      });
      expectAssertion(function () {
        return store.get("defaultAdapter");
      });
    });

    test("Calling Store#find invokes its adapter#find", function () {
      expect(5);

      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          ok(true, "Adapter#find was called");
          equal(store, currentStore, "Adapter#find was called with the right store");
          equal(type, store.modelFor("test"), "Adapter#find was called with the type passed into Store#find");
          equal(id, 1, "Adapter#find was called with the id passed into Store#find");
          equal(snapshot.id, "1", "Adapter#find was called with the record created from Store#find");

          return Ember.RSVP.resolve({ id: 1 });
        }
      });

      var currentType = DS.Model.extend();
      var currentStore = createStore({ adapter: adapter, test: currentType });

      run(function () {
        currentStore.findRecord("test", 1);
      });
    });

    test("Calling Store#findRecord multiple times coalesces the calls into a adapter#findMany call", function () {
      expect(2);

      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          ok(false, "Adapter#findRecord was not called");
        },
        findMany: function (store, type, ids, snapshots) {
          start();
          ok(true, "Adapter#findMany was called");
          deepEqual(ids, ["1", "2"], "Correct ids were passed in to findMany");
          return Ember.RSVP.resolve([{ id: 1 }, { id: 2 }]);
        },
        coalesceFindRequests: true
      });

      var currentType = DS.Model.extend();
      var currentStore = createStore({ adapter: adapter, test: currentType });

      stop();
      run(function () {
        currentStore.findRecord("test", 1);
        currentStore.findRecord("test", 2);
      });
    });

    test("Returning a promise from `findRecord` asynchronously loads data", function () {
      expect(1);

      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return resolve({ id: 1, name: "Scumbag Dale" });
        }
      });

      var currentType = DS.Model.extend({
        name: DS.attr("string")
      });
      var currentStore = createStore({ adapter: adapter, test: currentType });

      run(function () {
        currentStore.findRecord("test", 1).then(async(function (object) {
          strictEqual(get(object, "name"), "Scumbag Dale", "the data was pushed");
        }));
      });
    });

    test("IDs provided as numbers are coerced to strings", function () {
      expect(4);

      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          equal(typeof id, "string", "id has been normalized to a string");
          return resolve({ id: 1, name: "Scumbag Sylvain" });
        }
      });

      var currentType = DS.Model.extend({
        name: DS.attr("string")
      });
      var currentStore = createStore({ adapter: adapter, test: currentType });

      run(function () {
        currentStore.findRecord("test", 1).then(async(function (object) {
          equal(typeof object.get("id"), "string", "id was coerced to a string");
          run(function () {
            currentStore.push("test", { id: 2, name: "Scumbag Sam Saffron" });
          });
          return currentStore.findRecord("test", 2);
        })).then(async(function (object) {
          ok(object, "object was found");
          equal(typeof object.get("id"), "string", "id is a string despite being supplied and searched for as a number");
        }));
      });
    });

    var array = [{ id: "1", name: "Scumbag Dale" }, { id: "2", name: "Scumbag Katz" }, { id: "3", name: "Scumbag Bryn" }];

    test("can load data for the same record if it is not dirty", function () {
      expect(3);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var store = createStore({
        person: Person
      });

      run(function () {
        store.push("person", { id: 1, name: "Tom Dale" });

        store.findRecord("person", 1).then(async(function (tom) {
          equal(get(tom, "hasDirtyAttributes"), false, "precond - record is not dirty");
          equal(get(tom, "name"), "Tom Dale", "returns the correct name");

          store.push("person", { id: 1, name: "Captain Underpants" });
          equal(get(tom, "name"), "Captain Underpants", "updated record with new date");
        }));
      });
    });

    /*
    test("DS.Store loads individual records without explicit IDs with a custom primaryKey", function() {
      var store = DS.Store.create();
      var Person = DS.Model.extend({ name: DS.attr('string'), primaryKey: 'key' });

      store.load(Person, { key: 1, name: "Tom Dale" });

      var tom = store.findRecord(Person, 1);
      equal(get(tom, 'name'), "Tom Dale", "the person was successfully loaded for the given ID");
    });
    */

    test("pushMany extracts ids from an Array of hashes if no ids are specified", function () {
      expect(1);

      var Person = DS.Model.extend({ name: DS.attr("string") });

      var store = createStore({
        person: Person
      });

      run(function () {
        store.pushMany("person", array);
        store.findRecord("person", 1).then(async(function (person) {
          equal(get(person, "name"), "Scumbag Dale", "correctly extracted id for loaded data");
        }));
      });
    });

    test("loadMany takes an optional Object and passes it on to the Adapter", function () {
      expect(2);

      var passedQuery = { page: 1 };

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var adapter = TestAdapter.extend({
        query: function (store, type, query) {
          equal(type, store.modelFor("person"), "The type was Person");
          equal(query, passedQuery, "The query was passed in");
          return Ember.RSVP.resolve([]);
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });

      run(function () {
        store.query("person", passedQuery);
      });
    });

    test("Find with query calls the correct normalizeResponse", function () {
      var passedQuery = { page: 1 };

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var adapter = TestAdapter.extend({
        query: function (store, type, query) {
          return Ember.RSVP.resolve([]);
        }
      });

      var callCount = 0;

      var ApplicationSerializer = DS.JSONSerializer.extend({
        normalizeQueryResponse: function () {
          callCount++;
          return this._super.apply(this, arguments);
        }
      });

      var env = setupStore({
        adapter: adapter,
        person: Person
      });
      var store = env.store;

      env.registry.register("serializer:application", ApplicationSerializer);

      run(function () {
        store.query("person", passedQuery);
      });
      equal(callCount, 1, "normalizeQueryResponse was called");
    });

    test("peekAll(type) returns a record array of all records of a specific type", function () {
      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var store = createStore({
        person: Person
      });

      run(function () {
        store.push("person", { id: 1, name: "Tom Dale" });
      });

      var results = store.peekAll("person");
      equal(get(results, "length"), 1, "record array should have the original object");
      equal(get(results.objectAt(0), "name"), "Tom Dale", "record has the correct information");

      run(function () {
        store.push("person", { id: 2, name: "Yehuda Katz" });
      });
      equal(get(results, "length"), 2, "record array should have the new object");
      equal(get(results.objectAt(1), "name"), "Yehuda Katz", "record has the correct information");

      strictEqual(results, store.peekAll("person"), "subsequent calls to peekAll return the same recordArray)");
    });

    test("a new record of a particular type is created via store.createRecord(type)", function () {
      var Person = DS.Model.extend({
        name: DS.attr("string")
      });
      var person;

      var store = createStore({
        person: Person
      });

      run(function () {
        person = store.createRecord("person");
      });

      equal(get(person, "isLoaded"), true, "A newly created record is loaded");
      equal(get(person, "isNew"), true, "A newly created record is new");
      equal(get(person, "hasDirtyAttributes"), true, "A newly created record is dirty");

      run(function () {
        set(person, "name", "Braaahm Dale");
      });

      equal(get(person, "name"), "Braaahm Dale", "Even if no hash is supplied, `set` still worked");
    });

    test("a new record with a specific id can't be created if this id is already used in the store", function () {
      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      Person.reopenClass({
        toString: function () {
          return "Person";
        }
      });

      var store = createStore({
        person: Person
      });

      run(function () {
        store.createRecord("person", { id: 5 });
      });

      expectAssertion(function () {
        run(function () {
          store.createRecord("person", { id: 5 });
        });
      }, /The id 5 has already been used with another record of type Person/);
    });

    test("an initial data hash can be provided via store.createRecord(type, hash)", function () {
      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var store = createStore({
        person: Person
      });

      run(function () {
        person = store.createRecord("person", { name: "Brohuda Katz" });
      });

      equal(get(person, "isLoaded"), true, "A newly created record is loaded");
      equal(get(person, "isNew"), true, "A newly created record is new");
      equal(get(person, "hasDirtyAttributes"), true, "A newly created record is dirty");

      equal(get(person, "name"), "Brohuda Katz", "The initial data hash is provided");
    });

    test("if an id is supplied in the initial data hash, it can be looked up using `store.find`", function () {
      expect(1);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });
      var store = createStore({
        person: Person
      });
      var person;

      run(function () {
        person = store.createRecord("person", { id: 1, name: "Brohuda Katz" });
        store.findRecord("person", 1).then(async(function (again) {
          strictEqual(person, again, "the store returns the loaded object");
        }));
      });
    });

    test("initial values of attributes can be passed in as the third argument to find", function () {
      expect(1);

      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          equal(snapshot.attr("name"), "Test", "Preloaded attribtue set");
          return Ember.RSVP.resolve({ id: "1", name: "Test" });
        }
      });

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var store = createStore({
        adapter: adapter,
        test: Person
      });

      run(function () {
        store.findRecord("test", 1, { preload: { name: "Test" } });
      });
    });

    test("initial values of belongsTo can be passed in as the third argument to find as records", function () {
      expect(1);
      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          equal(snapshot.belongsTo("friend").attr("name"), "Tom", "Preloaded belongsTo set");
          return new Ember.RSVP.Promise(function () {});
        }
      });

      var env = setupStore({
        adapter: adapter
      });
      var store = env.store;

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        friend: DS.belongsTo("person", { inverse: null, async: true })
      });

      env.registry.register("model:person", Person);
      var tom;

      run(function () {
        tom = store.push("person", { id: 2, name: "Tom" });
        store.findRecord("person", 1, { preload: { friend: tom } });
      });
    });

    test("initial values of belongsTo can be passed in as the third argument to find as ids", function () {
      expect(1);

      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          return Ember.RSVP.Promise.resolve({ id: id });
        }
      });

      var env = setupStore({
        adapter: adapter
      });
      var store = env.store;

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        friend: DS.belongsTo("person", { async: true, inverse: null })
      });

      env.registry.register("model:person", Person);

      run(function () {
        store.findRecord("person", 1, { preload: { friend: 2 } }).then(async(function () {
          store.peekRecord("person", 1).get("friend").then(async(function (friend) {
            equal(friend.get("id"), "2", "Preloaded belongsTo set");
          }));
        }));
      });
    });

    test("initial values of hasMany can be passed in as the third argument to find as records", function () {
      expect(1);
      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          equal(snapshot.hasMany("friends")[0].attr("name"), "Tom", "Preloaded hasMany set");
          return new Ember.RSVP.Promise(function () {});
        }
      });

      var env = setupStore({
        adapter: adapter
      });
      var store = env.store;

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        friends: DS.hasMany("person", { inverse: null, async: true })
      });

      env.registry.register("model:person", Person);
      var tom;

      run(function () {
        tom = store.push("person", { id: 2, name: "Tom" });
        store.findRecord("person", 1, { preload: { friends: [tom] } });
      });
    });

    test("initial values of hasMany can be passed in as the third argument to find as ids", function () {
      expect(1);

      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          equal(snapshot.hasMany("friends")[0].id, "2", "Preloaded hasMany set");
          return Ember.RSVP.resolve({ id: id });
        }
      });

      var env = setupStore({
        adapter: adapter
      });
      var store = env.store;

      var Person = DS.Model.extend({
        name: DS.attr("string"),
        friends: DS.hasMany("person", { async: true, inverse: null })
      });

      env.registry.register("model:person", Person);

      run(function () {
        store.findRecord("person", 1, { preload: { friends: [2] } });
      });
    });

    test("records should have their ids updated when the adapter returns the id data", function () {
      expect(2);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var idCounter = 1;
      var adapter = TestAdapter.extend({
        createRecord: function (store, type, snapshot) {
          return Ember.RSVP.resolve({ name: snapshot.attr("name"), id: idCounter++ });
        }
      });

      var store = createStore({
        adapter: adapter,
        person: Person
      });

      var people = store.peekAll("person");
      var tom, yehuda;

      run(function () {
        tom = store.createRecord("person", { name: "Tom Dale" });
        yehuda = store.createRecord("person", { name: "Yehuda Katz" });
      });

      run(function () {
        Ember.RSVP.all([tom.save(), yehuda.save()]).then(async(function () {
          people.forEach(function (person, index) {
            equal(person.get("id"), index + 1, "The record's id should be correct.");
          });
        }));
      });
    });

    test("store.fetchMany should always return a promise", function () {
      expect(3);

      var Person = DS.Model.extend();
      var store = createStore({
        adapter: TestAdapter.extend(),
        person: Person
      });
      run(function () {
        store.createRecord("person");
      });
      var records = Ember.A([]);
      var results;

      run(function () {
        results = store.scheduleFetchMany(records);
      });
      ok(results, "A call to store.scheduleFetchMany() should return a result");
      ok(results.then, "A call to store.scheduleFetchMany() should return a promise");

      results.then(async(function (returnedRecords) {
        deepEqual(returnedRecords, [], "The correct records are returned");
      }));
    });

    test("store.scheduleFetchMany should not resolve until all the records are resolved", function () {
      expect(1);

      var Person = DS.Model.extend();
      var Phone = DS.Model.extend();

      var adapter = TestAdapter.extend({
        findRecord: function (store, type, id, snapshot) {
          var wait = 5;

          var record = { id: id };

          return new Ember.RSVP.Promise(function (resolve, reject) {
            run.later(function () {
              resolve(record);
            }, wait);
          });
        },

        findMany: function (store, type, ids, snapshots) {
          var wait = 15;

          var records = ids.map(function (id) {
            return { id: id };
          });

          return new Ember.RSVP.Promise(function (resolve, reject) {
            run.later(function () {
              resolve(records);
            }, wait);
          });
        }
      });

      var store = createStore({
        adapter: adapter,
        test: Person,
        phone: Phone
      });

      run(function () {
        store.createRecord("test");
      });

      var records = Ember.A([store.recordForId("test", 10), store.recordForId("phone", 20), store.recordForId("phone", 21)]);

      run(function () {
        store.scheduleFetchMany(records).then(async(function () {
          var unloadedRecords = records.filterBy("isEmpty");
          equal(get(unloadedRecords, "length"), 0, "All unloaded records should be loaded");
        }));
      });
    });

    test("the store calls adapter.findMany according to groupings returned by adapter.groupRecordsForFindMany", function () {
      expect(3);

      var Person = DS.Model.extend();

      var adapter = TestAdapter.extend({
        groupRecordsForFindMany: function (store, snapshots) {
          return [[snapshots[0]], [snapshots[1], snapshots[2]]];
        },

        findRecord: function (store, type, id, snapshot) {
          equal(id, "10", "The first group is passed to find");
          return Ember.RSVP.resolve({ id: id });
        },

        findMany: function (store, type, ids, snapshots) {
          var records = ids.map(function (id) {
            return { id: id };
          });

          deepEqual(ids, ["20", "21"], "The second group is passed to findMany");

          return new Ember.RSVP.Promise(function (resolve, reject) {
            resolve(records);
          });
        }
      });

      var store = createStore({
        adapter: adapter,
        test: Person
      });

      var records = Ember.A([store.recordForId("test", 10), store.recordForId("test", 20), store.recordForId("test", 21)]);

      run(function () {
        store.scheduleFetchMany(records).then(async(function () {
          var ids = records.mapBy("id");
          deepEqual(ids, ["10", "20", "21"], "The promise fulfills with the records");
        }));
      });
    });

    test("the promise returned by `scheduleFetch`, when it resolves, does not depend on the promises returned to other calls to `scheduleFetch` that are in the same run loop, but different groups", function () {
      expect(2);

      var Person = DS.Model.extend();
      var davidResolved = false;

      var adapter = TestAdapter.extend({
        groupRecordsForFindMany: function (store, snapshots) {
          return [[snapshots[0]], [snapshots[1]]];
        },

        findRecord: function (store, type, id, snapshot) {
          var record = { id: id };

          return new Ember.RSVP.Promise(function (resolve, reject) {
            if (id === "igor") {
              resolve(record);
            } else {
              run.later(function () {
                davidResolved = true;
                resolve(record);
              }, 5);
            }
          });
        }
      });

      var store = createStore({
        adapter: adapter,
        test: Person
      });

      run(function () {
        var davidPromise = store.findRecord("test", "david");
        var igorPromise = store.findRecord("test", "igor");

        igorPromise.then(async(function () {
          equal(davidResolved, false, "Igor did not need to wait for David");
        }));

        davidPromise.then(async(function () {
          equal(davidResolved, true, "David resolved");
        }));
      });
    });

    test("the promise returned by `scheduleFetch`, when it rejects, does not depend on the promises returned to other calls to `scheduleFetch` that are in the same run loop, but different groups", function () {
      expect(2);

      var Person = DS.Model.extend();
      var davidResolved = false;

      var adapter = TestAdapter.extend({
        groupRecordsForFindMany: function (store, snapshots) {
          return [[snapshots[0]], [snapshots[1]]];
        },

        findRecord: function (store, type, id, snapshot) {
          var record = { id: id };

          return new Ember.RSVP.Promise(function (resolve, reject) {
            if (id === "igor") {
              reject(record);
            } else {
              run.later(function () {
                davidResolved = true;
                resolve(record);
              }, 5);
            }
          });
        }
      });

      var store = createStore({
        adapter: adapter,
        test: Person
      });

      run(function () {
        var davidPromise = store.findRecord("test", "david");
        var igorPromise = store.findRecord("test", "igor");

        igorPromise.then(null, async(function () {
          equal(davidResolved, false, "Igor did not need to wait for David");
        }));

        davidPromise.then(async(function () {
          equal(davidResolved, true, "David resolved");
        }));
      });
    });

    test("store.fetchRecord reject records that were not found, even when those requests were coalesced with records that were found", function () {
      expect(4);

      var Person = DS.Model.extend();

      var adapter = TestAdapter.extend({
        findMany: function (store, type, ids, snapshots) {
          var records = ids.map(function (id) {
            return { id: id };
          });

          return new Ember.RSVP.Promise(function (resolve, reject) {
            resolve([records[0]]);
          });
        }
      });

      var store = createStore({
        adapter: adapter,
        test: Person
      });

      warns(function () {
        run(function () {
          var davidPromise = store.findRecord("test", "david");
          var igorPromise = store.findRecord("test", "igor");

          davidPromise.then(async(function () {
            ok(true, "David resolved");
          }));

          igorPromise.then(null, async(function () {
            ok(true, "Igor rejected");
          }));
        });
      }, /expected to find records with the following ids in the adapter response but they were missing/);
    });

    test("store should not call shouldReloadRecord when the record is not in the store", function () {
      expect(1);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldReloadRecord: function (store, type, id, snapshot) {
          ok(false, "shouldReloadRecord should not be called when the record is not loaded");
          return false;
        },
        findRecord: function () {
          ok(true, "find is always called when the record is not in the store");
          return { id: 1 };
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.findRecord("person", 1);
      });
    });

    test("store should not reload record when shouldReloadRecord returns false", function () {
      expect(1);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldReloadRecord: function (store, type, id, snapshot) {
          ok(true, "shouldReloadRecord should be called when the record is in the store");
          return false;
        },
        findRecord: function () {
          ok(false, "find should not be called when shouldReloadRecord returns false");
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.push("person", { id: 1 });
        store.findRecord("person", 1);
      });
    });

    test("store should reload record when shouldReloadRecord returns true", function () {
      expect(3);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldReloadRecord: function (store, type, id, snapshot) {
          ok(true, "shouldReloadRecord should be called when the record is in the store");
          return true;
        },
        findRecord: function () {
          ok(true, "find should not be called when shouldReloadRecord returns false");
          return { id: 1, name: "Tom" };
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.push("person", { id: 1 });
        store.findRecord("person", 1).then(function (record) {
          equal(record.get("name"), "Tom");
        });
      });
    });

    test("store should not call shouldBackgroundReloadRecord when the store is already loading the record", function () {
      expect(2);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldReloadRecord: function (store, type, id, snapshot) {
          return true;
        },
        shouldBackgroundReloadRecord: function (store, type, id, snapshot) {
          ok(false, "shouldBackgroundReloadRecord is not called when shouldReloadRecord returns true");
        },
        findRecord: function () {
          ok(true, "find should be called");
          return { id: 1, name: "Tom" };
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.push("person", { id: 1 });
        store.findRecord("person", 1).then(function (record) {
          equal(record.get("name"), "Tom");
        });
      });
    });

    test("store should not reload a record when `shouldBackgroundReloadRecord` is false", function () {
      expect(2);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldBackgroundReloadRecord: function (store, type, id, snapshot) {
          ok(true, "shouldBackgroundReloadRecord is called when record is loaded form the cache");
          return false;
        },
        findRecord: function () {
          ok(false, "find should not be called");
          return { id: 1, name: "Tom" };
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.push("person", { id: 1 });
        store.findRecord("person", 1).then(function (record) {
          equal(record.get("name"), undefined);
        });
      });
    });

    test("store should reload the record in the background when `shouldBackgroundReloadRecord` is true", function () {
      expect(4);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldBackgroundReloadRecord: function (store, type, id, snapshot) {
          ok(true, "shouldBackgroundReloadRecord is called when record is loaded form the cache");
          return true;
        },
        findRecord: function () {
          ok(true, "find should not be called");
          return { id: 1, name: "Tom" };
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.push("person", { id: 1 });
        store.findRecord("person", 1).then(function (record) {
          equal(record.get("name"), undefined);
        });
      });

      equal(store.peekRecord("person", 1).get("name"), "Tom");
    });

    test("store should not reload record array when shouldReloadAll returns false", function () {
      expect(1);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldReloadAll: function (store, snapshot) {
          ok(true, "shouldReloadAll should be called when the record is in the store");
          return false;
        },
        shouldBackgroundReloadAll: function (store, snapshot) {
          return false;
        },
        findAll: function () {
          ok(false, "findAll should not be called when shouldReloadAll returns false");
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.findAll("person");
      });
    });

    test("store should reload all records when shouldReloadAll returns true", function () {
      expect(3);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldReloadAll: function (store, type, id, snapshot) {
          ok(true, "shouldReloadAll should be called when the record is in the store");
          return true;
        },
        findAll: function () {
          ok(true, "findAll should be called when shouldReloadAll returns true");
          return [{ id: 1, name: "Tom" }];
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.findAll("person").then(function (records) {
          equal(records.get("firstObject.name"), "Tom");
        });
      });
    });

    test("store should not call shouldBackgroundReloadAll when the store is already loading all records", function () {
      expect(2);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldReloadAll: function (store, type, id, snapshot) {
          return true;
        },
        shouldBackgroundReloadAll: function (store, type, id, snapshot) {
          ok(false, "shouldBackgroundReloadRecord is not called when shouldReloadRecord returns true");
        },
        findAll: function () {
          ok(true, "find should be called");
          return [{ id: 1, name: "Tom" }];
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.findAll("person").then(function (records) {
          equal(records.get("firstObject.name"), "Tom");
        });
      });
    });

    test("store should not reload all records when `shouldBackgroundReloadAll` is false", function () {
      expect(3);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldReloadAll: function (store, type, id, snapshot) {
          ok(true, "shouldReloadAll is called when record is loaded form the cache");
          return false;
        },
        shouldBackgroundReloadAll: function (store, type, id, snapshot) {
          ok(true, "shouldBackgroundReloadAll is called when record is loaded form the cache");
          return false;
        },
        findAll: function () {
          ok(false, "findAll should not be called");
          return [{ id: 1, name: "Tom" }];
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.findAll("person").then(function (records) {
          equal(records.get("firstObject"), undefined);
        });
      });
    });

    test("store should reload all records in the background when `shouldBackgroundReloadAll` is true", function () {
      expect(5);

      var Person = DS.Model.extend({
        name: DS.attr("string")
      });

      var TestAdapter = DS.Adapter.extend({
        shouldReloadAll: function () {
          ok(true, "shouldReloadAll is called");
          return false;
        },
        shouldBackgroundReloadAll: function (store, snapshot) {
          ok(true, "shouldBackgroundReloadAll is called when record is loaded form the cache");
          return true;
        },
        findAll: function () {
          ok(true, "find should not be called");
          return [{ id: 1, name: "Tom" }];
        }
      });

      store = createStore({
        adapter: TestAdapter,
        person: Person
      });

      run(function () {
        store.findAll("person").then(function (records) {
          equal(records.get("firstObject.name"), undefined);
        });
      });

      equal(store.peekRecord("person", 1).get("name"), "Tom");
    });

    module("unit/store/adapter_interop - find preload deprecations", {
      setup: function () {
        var Person = DS.Model.extend({
          name: DS.attr("string")
        });

        var TestAdapter = DS.Adapter.extend({
          findRecord: function (store, type, id, snapshot) {
            equal(snapshot.attr("name"), "Tom");
            return Ember.RSVP.resolve({ id: id });
          }
        });

        store = createStore({
          adapter: TestAdapter,
          person: Person
        });
      },
      teardown: function () {
        run(function () {
          if (store) {
            store.destroy();
          }
        });
      }
    });
  }
);


define(
  "ember-data/tests/unit/store/create-record-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var store, container, Record, Storage;
    var run = Ember.run;

    module('unit/store/createRecord - Store creating records', {
      setup: function () {
        Record = DS.Model.extend({
          title: DS.attr('string')
        });

        Storage = DS.Model.extend({
          name: DS.attr('name'),
          records: DS.hasMany('record', { async: false })
        });

        store = createStore({
          adapter: DS.Adapter.extend(),
          record: Record,
          storage: Storage
        });
      }
    });

    test('doesn\'t modify passed in properties hash', function () {
      var attributes = { foo: 'bar' };
      run(function () {
        store.createRecord('record', attributes);
        store.createRecord('record', attributes);
      });

      deepEqual(attributes, { foo: 'bar' }, 'The properties hash is not modified');
    });

    test('allow passing relationships as well as attributes', function () {
      var records, storage;
      run(function () {
        records = store.pushMany('record', [{ id: 1, title: 'it\'s a beautiful day' }, { id: 2, title: 'it\'s a beautiful day' }]);
        storage = store.createRecord('storage', { name: 'Great store', records: records });
      });

      equal(storage.get('name'), 'Great store', 'The attribute is well defined');
      equal(storage.get('records').findBy('id', '1'), Ember.A(records).findBy('id', '1'), 'Defined relationships are allowed in createRecord');
      equal(storage.get('records').findBy('id', '2'), Ember.A(records).findBy('id', '2'), 'Defined relationships are allowed in createRecord');
    });

    module('unit/store/createRecord - Store with models by dash', {
      setup: function () {
        var env = setupStore({
          someThing: DS.Model.extend({ foo: DS.attr('string') })
        });
        store = env.store;
        container = env.container;
      }
    });
    test('creating a record by camel-case string finds the model', function () {
      var attributes = { foo: 'bar' };
      var record;

      run(function () {
        record = store.createRecord('some-thing', attributes);
      });

      equal(record.get('foo'), attributes.foo, 'The record is created');
      equal(store.modelFor('someThing').modelName, 'some-thing');
    });

    test('creating a record by dasherize string finds the model', function () {
      var attributes = { foo: 'bar' };
      var record;

      run(function () {
        record = store.createRecord('some-thing', attributes);
      });

      equal(record.get('foo'), attributes.foo, 'The record is created');
      equal(store.modelFor('some-thing').modelName, 'some-thing');
    });

    module('unit/store/createRecord - Store with models by camelCase', {
      setup: function () {
        var env = setupStore({
          someThing: DS.Model.extend({ foo: DS.attr('string') })
        });
        store = env.store;
        container = env.container;
      }
    });

    test('creating a record by camel-case string finds the model', function () {
      var attributes = { foo: 'bar' };
      var record;

      run(function () {
        record = store.createRecord('some-thing', attributes);
      });

      equal(record.get('foo'), attributes.foo, 'The record is created');
      equal(store.modelFor('someThing').modelName, 'some-thing');
    });

    test('creating a record by dasherize string finds the model', function () {
      var attributes = { foo: 'bar' };
      var record;

      run(function () {
        record = store.createRecord('some-thing', attributes);
      });

      equal(record.get('foo'), attributes.foo, 'The record is created');
      equal(store.modelFor('some-thing').modelName, 'some-thing');
    });
  }
);


define(
  "ember-data/tests/unit/store/has_record_for_id_test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, Person, PhoneNumber;
    var attr = DS.attr;
    var hasMany = DS.hasMany;
    var belongsTo = DS.belongsTo;
    var run = Ember.run;

    module('unit/store/hasRecordForId - Store hasRecordForId', {
      setup: function () {

        Person = DS.Model.extend({
          firstName: attr('string'),
          lastName: attr('string'),
          phoneNumbers: hasMany('phone-number', { async: false })
        });
        Person.toString = function () {
          return 'Person';
        };

        PhoneNumber = DS.Model.extend({
          number: attr('string'),
          person: belongsTo('person', { async: false })
        });
        PhoneNumber.toString = function () {
          return 'PhoneNumber';
        };

        env = setupStore({
          person: Person,
          'phone-number': PhoneNumber
        });

        store = env.store;
      },

      teardown: function () {
        Ember.run(store, 'destroy');
      }
    });

    test('hasRecordForId should return false for records in the empty state ', function () {

      run(function () {
        store.push('person', {
          id: 1,
          firstName: 'Yehuda',
          lastName: 'Katz',
          phoneNumbers: [1]
        });

        equal(false, store.hasRecordForId('phone-number', 1), 'hasRecordForId only returns true for loaded records');
      });
    });

    test('hasRecordForId should return true for records in the loaded state ', function () {
      run(function () {
        store.push('person', {
          id: 1,
          firstName: 'Yehuda',
          lastName: 'Katz',
          phoneNumbers: [1]
        });

        equal(true, store.hasRecordForId('person', 1), 'hasRecordForId returns true for records loaded into the store');
      });
    });
  }
);


define(
  "ember-data/tests/unit/store/lookup-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var store, env, applicationAdapter, applicationSerializer, Person;
    var run = Ember.run;

    function resetStore() {
      if (store) {
        run(store, 'destroy');
      }
      env = setupStore({
        adapter: '-rest',
        person: Person
      });

      env.registry.unregister('adapter:application');
      env.registry.unregister('serializer:application');

      env.registry.optionsForType('serializer', { singleton: true });
      env.registry.optionsForType('adapter', { singleton: true });

      store = env.store;
    }

    function lookupAdapter(adapterName) {
      return run(store, 'adapterFor', adapterName);
    }

    function lookupSerializer(serializerName) {
      return run(store, 'serializerFor', serializerName);
    }

    function registerAdapter(adapterName, adapter) {
      env.registry.register('adapter:' + adapterName, adapter);
    }

    function registerSerializer(serializerName, serializer) {
      env.registry.register('serializer:' + serializerName, serializer);
    }

    module('unit/store/lookup - Managed Instance lookups', {
      setup: function () {
        Person = DS.Model.extend();
        resetStore();
        env.registry.register('adapter:application', DS.Adapter.extend());
        env.registry.register('adapter:serializer', DS.Adapter.extend());

        applicationAdapter = run(store, 'adapterFor', 'application');
        applicationSerializer = run(store, 'serializerFor', 'application');
      },

      teardown: function () {
        run(store, 'destroy');
      }
    });

    test('when the adapter does not exist for a type, the fallback is returned', function () {
      var personAdapter = lookupAdapter('person');

      strictEqual(personAdapter, applicationAdapter);
    });

    test('when the adapter for a type exists, returns that instead of the fallback', function () {
      registerAdapter('person', DS.Adapter.extend());
      var personAdapter = lookupAdapter('person');

      ok(personAdapter !== applicationAdapter);
    });

    test('when the serializer does not exist for a type, the fallback is returned', function () {
      var personSerializer = lookupSerializer('person');

      strictEqual(personSerializer, applicationSerializer);
    });

    test('when the serializer does exist for a type, the serializer is returned', function () {
      registerSerializer('person', DS.Serializer.extend());

      var personSerializer = lookupSerializer('person');

      ok(personSerializer !== applicationSerializer);
    });

    test('adapter lookup order', function () {
      expect(3);

      resetStore();

      var personAdapter = lookupAdapter('person');

      strictEqual(personAdapter, lookupAdapter('-rest'), 'looks up the RESTAdapter first');
      resetStore();

      registerAdapter('application', DS.RESTSerializer.extend());
      personAdapter = lookupAdapter('person');

      strictEqual(personAdapter, lookupAdapter('application'), 'looks up application adapter before RESTAdapter if it exists');

      resetStore();

      registerAdapter('application', DS.RESTSerializer.extend());
      registerAdapter('person', DS.RESTSerializer.extend({ customThingy: true }));

      ok(lookupAdapter('person').get('customThingy'), 'looks up type serializer before application');
    });

    test('serializer lookup order', function () {
      resetStore();

      var personSerializer = lookupSerializer('person');

      strictEqual(personSerializer, lookupSerializer('-rest'));

      resetStore();

      registerSerializer('application', DS.RESTSerializer.extend());
      personSerializer = lookupSerializer('person');
      strictEqual(personSerializer, lookupSerializer('application'), 'looks up application before default');

      resetStore();
      registerAdapter('person', DS.Adapter.extend({
        defaultSerializer: '-rest'
      }));
      personSerializer = lookupSerializer('person');

      strictEqual(personSerializer, lookupSerializer('-rest'), 'uses defaultSerializer on adapterFor("model") if application not defined');

      resetStore();
      registerAdapter('person', DS.Adapter.extend({
        defaultSerializer: '-rest'
      }));
      registerSerializer('application', DS.RESTSerializer.extend());
      registerSerializer('person', DS.JSONSerializer.extend({ customThingy: true }));
      personSerializer = lookupSerializer('person');

      ok(personSerializer.get('customThingy'), 'uses the person serializer before any fallbacks if it is defined');
    });
  }
);


define(
  "ember-data/tests/unit/store/metadata-for-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var store;

    var run = Ember.run;

    module("unit/store/metadata_for - DS.Store#metadataFor", {
      setup: function () {
        store = createStore({
          post: DS.Model.extend(),
          comment: DS.Model.extend()
        });
      },

      teardown: function () {
        run(function () {
          store.destroy();
        });
      }
    });

    test("metaForType should be deprecated", function () {
      expect(1);

      expectDeprecation(function () {
        store.metaForType("post", { foo: "bar" });
      });
    });

    test("metadataFor and setMetadataFor should return and set correct metadata", function () {
      expect(7);

      function metadataKeys(type) {
        return Object.keys(store.metadataFor(type));
      }

      // Currently not using QUnit.deepEqual due to the way deepEqual
      // comparing __proto__. In its check to see if an object has
      // no proto, it checks strict equality on null instead of null or undefined.

      deepEqual(metadataKeys("post"), [], "Metadata for post is initially empty");

      store.setMetadataFor("post", { foo: "bar" });

      deepEqual(metadataKeys("post"), ["foo"], "metadata for post contains foo:bar");
      equal(store.metadataFor("post").foo, "bar");

      store.setMetadataFor("post", { hello: "world" });

      deepEqual(metadataKeys("post"), ["foo", "hello"]);
      equal(store.metadataFor("post").foo, "bar", "keeps original metadata");
      equal(store.metadataFor("post").hello, "world", "merges new metadata");

      deepEqual(metadataKeys("comment"), [], "metadata for comment is empty");
    });
  }
);


define(
  "ember-data/tests/unit/store/model-for-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var container, store, registry;

    var camelize = Ember.String.camelize;
    var dasherize = Ember.String.dasherize;

    var run = Ember.run;
    var env;

    module("unit/store/model_for - DS.Store#modelFor", {
      setup: function () {
        env = setupStore({
          blogPost: DS.Model.extend(),
          "blog.post": DS.Model.extend()
        });
        store = env.store;
        container = store.container;
        registry = env.registry;
      },

      teardown: function () {
        run(function () {
          container.destroy();
          store.destroy();
        });
      }
    });

    test("when fetching factory from string, sets a normalized key as modelName", function () {
      env.replaceContainerNormalize(function (key) {
        return dasherize(camelize(key));
      });

      equal(registry.normalize("some.post"), "some-post", "precond - container camelizes");
      equal(store.modelFor("blog.post").modelName, "blog.post", "modelName is normalized to dasherized");
    });

    test("when fetching factory from string and dashing normalizer, sets a normalized key as modelName", function () {
      env.replaceContainerNormalize(function (key) {
        return dasherize(camelize(key));
      });
      equal(registry.normalize("some.post"), "some-post", "precond - container dasherizes");
      equal(store.modelFor("blog.post").modelName, "blog.post", "modelName is normalized to dasherized");
    });

    test("when fetching something that doesn't exist, throws error", function () {
      throws(function () {
        store.modelFor("wild-stuff");
      }, /No model was found/);
    });
  }
);


define(
  "ember-data/tests/unit/store/peek-record-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, Person;
    var run = Ember.run;

    module('unit/store/peekRecord - Store peekRecord', {
      setup: function () {

        Person = DS.Model.extend();
        Person.toString = function () {
          return 'Person';
        };

        env = setupStore({
          person: Person
        });
        store = env.store;
      },

      teardown: function () {
        Ember.run(store, 'destroy');
      }
    });

    test('peekRecord should return the record if it is in the store ', function () {
      run(function () {
        var person = store.push('person', { id: 1 });
        equal(person, store.peekRecord('person', 1), 'peekRecord only return the corresponding record in the store');
      });
    });

    test('peekRecord should return null if the record is not in the store ', function () {
      run(function () {
        equal(null, store.peekRecord('person', 1), 'peekRecord returns null if the corresponding record is not in the store');
      });
    });
  }
);


define(
  "ember-data/tests/unit/store/push-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var env, store, Person, PhoneNumber, Post;
    var attr = DS.attr;
    var hasMany = DS.hasMany;
    var belongsTo = DS.belongsTo;
    var run = Ember.run;

    module('unit/store/push - DS.Store#push', {
      setup: function () {
        Person = DS.Model.extend({
          firstName: attr('string'),
          lastName: attr('string'),
          phoneNumbers: hasMany('phone-number', { async: false })
        });
        Person.toString = function () {
          return 'Person';
        };

        PhoneNumber = DS.Model.extend({
          number: attr('string'),
          person: belongsTo('person', { async: false })
        });
        PhoneNumber.toString = function () {
          return 'PhoneNumber';
        };

        Post = DS.Model.extend({
          postTitle: attr('string')
        });
        Post.toString = function () {
          return 'Post';
        };

        env = setupStore({
          post: Post,
          person: Person,
          'phone-number': PhoneNumber
        });

        store = env.store;

        env.registry.register('serializer:post', DS.RESTSerializer);
      },

      teardown: function () {
        run(function () {
          store.destroy();
        });
      }
    });

    test('Calling push with a normalized hash returns a record', function () {
      expect(2);

      run(function () {
        var person = store.push({
          type: 'person',
          id: 'wat',
          attributes: {
            firstName: 'Yehuda',
            lastName: 'Katz'
          }
        });
        store.findRecord('person', 'wat').then(function (foundPerson) {
          equal(foundPerson, person, 'record returned via load() is the same as the record returned from findRecord()');
          deepEqual(foundPerson.getProperties('id', 'firstName', 'lastName'), {
            id: 'wat',
            firstName: 'Yehuda',
            lastName: 'Katz'
          });
        });
      });
    });

    test('Supplying a model class for `push` is the same as supplying a string', function () {
      expect(1);

      var Programmer = Person.extend();
      env.registry.register('model:programmer', Programmer);

      run(function () {
        store.push({
          type: 'programmer',
          id: 'wat',
          attributes: {
            firstName: 'Yehuda',
            lastName: 'Katz'
          }
        });

        store.findRecord('programmer', 'wat').then(function (foundProgrammer) {
          deepEqual(foundProgrammer.getProperties('id', 'firstName', 'lastName'), {
            id: 'wat',
            firstName: 'Yehuda',
            lastName: 'Katz'
          });
        });
      });
    });

    test('Calling push triggers `didLoad` even if the record hasn\'t been requested from the adapter', function () {
      expect(1);

      Person.reopen({
        didLoad: async(function () {
          ok(true, 'The didLoad callback was called');
        })
      });

      run(function () {
        store.push({
          type: 'person',
          id: 'wat',
          attributes: {
            firstName: 'Yehuda',
            lastName: 'Katz'
          }
        });
      });
    });

    test('Calling update should be deprecated', function () {
      expectDeprecation(function () {
        run(function () {
          store.update('person', { id: '1', firstName: 'Yehuda', lastName: 'Katz' });
        });
      });
    });

    test('Calling push with partial records updates just those attributes', function () {
      expect(2);

      run(function () {
        var person = store.push({
          type: 'person',
          id: 'wat',
          attributes: {
            firstName: 'Yehuda',
            lastName: 'Katz'
          }
        });

        store.push({
          type: 'person',
          id: 'wat',
          attributes: {
            lastName: 'Katz!'
          }
        });

        store.findRecord('person', 'wat').then(function (foundPerson) {
          equal(foundPerson, person, 'record returned via load() is the same as the record returned from findRecord()');
          deepEqual(foundPerson.getProperties('id', 'firstName', 'lastName'), {
            id: 'wat',
            firstName: 'Yehuda',
            lastName: 'Katz!'
          });
        });
      });
    });

    test('Calling push on normalize allows partial updates with raw JSON', function () {
      env.registry.register('serializer:person', DS.RESTSerializer);
      var person;

      run(function () {
        person = store.push({
          data: {
            type: 'person',
            id: '1',
            attributes: {
              firstName: 'Robert',
              lastName: 'Jackson'
            }
          }
        });

        store.push(store.normalize('person', {
          id: '1',
          firstName: 'Jacquie'
        }));
      });

      equal(person.get('firstName'), 'Jacquie', 'you can push raw JSON into the store');
      equal(person.get('lastName'), 'Jackson', 'existing fields are untouched');
    });

    test('Calling push with a normalized hash containing related records returns a record', function () {
      var number1, number2, person;
      run(function () {
        number1 = store.push('phone-number', {
          id: 1,
          number: '5551212',
          person: 'wat'
        });

        number2 = store.push('phone-number', {
          id: 2,
          number: '5552121',
          person: 'wat'
        });

        person = store.push('person', {
          id: 'wat',
          firstName: 'John',
          lastName: 'Smith',
          phoneNumbers: [number1, number2]
        });
      });

      deepEqual(person.get('phoneNumbers').toArray(), [number1, number2], 'phoneNumbers array is correct');
    });

    test('Calling push with a normalized hash containing IDs of related records returns a record', function () {
      expect(1);

      Person.reopen({
        phoneNumbers: hasMany('phone-number', { async: true })
      });

      env.adapter.findRecord = function (store, type, id) {
        if (id === '1') {
          return Ember.RSVP.resolve({
            id: 1,
            number: '5551212',
            person: 'wat'
          });
        }

        if (id === '2') {
          return Ember.RSVP.resolve({
            id: 2,
            number: '5552121',
            person: 'wat'
          });
        }
      };
      var person;

      run(function () {
        person = store.push(store.normalize('person', {
          id: 'wat',
          firstName: 'John',
          lastName: 'Smith',
          phoneNumbers: ['1', '2']
        }));
        person.get('phoneNumbers').then(function (phoneNumbers) {
          deepEqual(phoneNumbers.map(function (item) {
            return item.getProperties('id', 'number', 'person');
          }), [{
            id: '1',
            number: '5551212',
            person: person
          }, {
            id: '2',
            number: '5552121',
            person: person
          }]);
        });
      });
    });

    test('Calling pushPayload allows pushing raw JSON', function () {
      run(function () {
        store.pushPayload('post', {
          posts: [{
            id: '1',
            postTitle: 'Ember rocks'
          }]
        });
      });

      var post = store.peekRecord('post', 1);

      equal(post.get('postTitle'), 'Ember rocks', 'you can push raw JSON into the store');

      run(function () {
        store.pushPayload('post', {
          posts: [{
            id: '1',
            postTitle: 'Ember rocks (updated)'
          }]
        });
      });

      equal(post.get('postTitle'), 'Ember rocks (updated)', 'You can update data in the store');
    });

    test('Calling pushPayload allows pushing singular payload properties', function () {
      run(function () {
        store.pushPayload('post', {
          post: {
            id: '1',
            postTitle: 'Ember rocks'
          }
        });
      });

      var post = store.peekRecord('post', 1);

      equal(post.get('postTitle'), 'Ember rocks', 'you can push raw JSON into the store');

      run(function () {
        store.pushPayload('post', {
          post: {
            id: '1',
            postTitle: 'Ember rocks (updated)'
          }
        });
      });

      equal(post.get('postTitle'), 'Ember rocks (updated)', 'You can update data in the store');
    });

    test('Calling pushPayload should use the type\'s serializer for normalizing', function () {
      expect(4);
      env.registry.register('serializer:post', DS.RESTSerializer.extend({
        normalize: function (store, payload) {
          ok(true, 'normalized is called on Post serializer');
          return this._super(store, payload);
        }
      }));
      env.registry.register('serializer:person', DS.RESTSerializer.extend({
        normalize: function (store, payload) {
          ok(true, 'normalized is called on Person serializer');
          return this._super(store, payload);
        }
      }));

      run(function () {
        store.pushPayload('post', {
          posts: [{
            id: 1,
            postTitle: 'Ember rocks'
          }],
          people: [{
            id: 2,
            firstName: 'Yehuda'
          }]
        });
      });

      var post = store.peekRecord('post', 1);

      equal(post.get('postTitle'), 'Ember rocks', 'you can push raw JSON into the store');

      var person = store.peekRecord('person', 2);

      equal(person.get('firstName'), 'Yehuda', 'you can push raw JSON into the store');
    });

    test('Calling pushPayload without a type uses application serializer\'s pushPayload method', function () {
      expect(1);

      env.registry.register('serializer:application', DS.RESTSerializer.extend({
        pushPayload: function (store, payload) {
          ok(true, 'pushPayload is called on Application serializer');
          return this._super(store, payload);
        }
      }));

      run(function () {
        store.pushPayload({
          posts: [{ id: '1', postTitle: 'Ember rocks' }]
        });
      });
    });

    test('Calling pushPayload without a type should use a model\'s serializer when normalizing', function () {
      expect(4);

      env.registry.register('serializer:post', DS.RESTSerializer.extend({
        normalize: function (store, payload) {
          ok(true, 'normalized is called on Post serializer');
          return this._super(store, payload);
        }
      }));

      env.registry.register('serializer:application', DS.RESTSerializer.extend({
        normalize: function (store, payload) {
          ok(true, 'normalized is called on Application serializer');
          return this._super(store, payload);
        }
      }));

      run(function () {
        store.pushPayload({
          posts: [{
            id: '1',
            postTitle: 'Ember rocks'
          }],
          people: [{
            id: '2',
            firstName: 'Yehuda'
          }]
        });
      });

      var post = store.peekRecord('post', 1);

      equal(post.get('postTitle'), 'Ember rocks', 'you can push raw JSON into the store');

      var person = store.peekRecord('person', 2);

      equal(person.get('firstName'), 'Yehuda', 'you can push raw JSON into the store');
    });

    test('Calling pushPayload allows partial updates with raw JSON', function () {
      env.registry.register('serializer:person', DS.RESTSerializer);

      var person;

      run(function () {
        store.pushPayload('person', {
          people: [{
            id: '1',
            firstName: 'Robert',
            lastName: 'Jackson'
          }]
        });
      });

      person = store.peekRecord('person', 1);

      equal(person.get('firstName'), 'Robert', 'you can push raw JSON into the store');
      equal(person.get('lastName'), 'Jackson', 'you can push raw JSON into the store');

      run(function () {
        store.pushPayload('person', {
          people: [{
            id: '1',
            firstName: 'Jacquie'
          }]
        });
      });

      equal(person.get('firstName'), 'Jacquie', 'you can push raw JSON into the store');
      equal(person.get('lastName'), 'Jackson', 'existing fields are untouched');
    });

    test('calling push without data argument as an object raises an error', function () {
      var invalidValues = [null, 1, 'string', Ember.Object.create(), Ember.Object.extend(), true];

      expect(invalidValues.length);

      invalidValues.forEach(function (invalidValue) {
        throws(function () {
          run(function () {
            store.push('person', invalidValue);
          });
        }, /object/);
      });
    });

    test('Calling push with a link for a non async relationship should warn', function () {
      Person.reopen({
        phoneNumbers: hasMany('phone-number', { async: false })
      });

      warns(function () {
        run(function () {
          store.push(store.normalize('person', {
            id: '1',
            links: {
              phoneNumbers: '/api/people/1/phone-numbers'
            }
          }));
        });
      }, /You have pushed a record of type 'person' with 'phoneNumbers' as a link, but the association is not an async relationship./);
    });

    test('Calling push with a link containing an object throws an assertion error', function () {
      Person.reopen({
        phoneNumbers: hasMany('phone-number', { async: true })
      });

      expectAssertion(function () {
        run(function () {
          store.push(store.normalize('person', {
            id: '1',
            links: {
              phoneNumbers: {
                href: '/api/people/1/phone-numbers'
              }
            }
          }));
        });
      }, 'You have pushed a record of type \'person\' with \'phoneNumbers\' as a link, but the value of that link is not a string.');
    });

    test('Calling push with a link containing the value null', function () {
      run(function () {
        store.push(store.normalize('person', {
          id: '1',
          firstName: 'Tan',
          links: {
            phoneNumbers: null
          }
        }));
      });

      var person = store.peekRecord('person', 1);

      equal(person.get('firstName'), 'Tan', 'you can use links that contain null as a value');
    });

    test('calling push with hasMany relationship the value must be an array', function () {
      var invalidValues = [1, 'string', Ember.Object.create(), Ember.Object.extend(), true];

      expect(invalidValues.length);

      invalidValues.forEach(function (invalidValue) {
        throws(function () {
          run(function () {
            store.push('person', { id: 1, phoneNumbers: invalidValue });
          });
        }, /must be an array/);
      });
    });

    test('calling push with missing or invalid `id` throws assertion error', function () {
      var invalidValues = [{}, { id: null }, { id: '' }];

      expect(invalidValues.length);

      invalidValues.forEach(function (invalidValue) {
        throws(function () {
          run(function () {
            store.push('person', invalidValue);
          });
        }, /You must include an `id`/);
      });
    });

    test('calling push with belongsTo relationship the value must not be an array', function () {
      throws(function () {
        run(function () {
          store.push('phone-number', { id: 1, person: [1] });
        });
      }, /must not be an array/);
    });

    test('calling push with an embedded relationship throws a useful error', function () {
      throws(function () {
        run(function () {
          store.push('person', {
            id: 1,
            firstName: 'Ada',
            lastName: 'Lovelace',
            phoneNumbers: [{ number: '5551212', person: 1 }]
          });
        });
      }, /If this is an embedded relationship/);
    });

    test('Enabling Ember.ENV.DS_WARN_ON_UNKNOWN_KEYS should warn on unknown keys', function () {
      run(function () {
        var originalFlagValue = Ember.ENV.DS_WARN_ON_UNKNOWN_KEYS;
        try {
          Ember.ENV.DS_WARN_ON_UNKNOWN_KEYS = true;
          warns(function () {
            store.push('person', {
              id: '1',
              firstName: 'Tomster',
              emailAddress: 'tomster@emberjs.com',
              isMascot: true
            });
          });
        } finally {
          Ember.ENV.DS_WARN_ON_UNKNOWN_KEYS = originalFlagValue;
        }
      });
    });

    test('Calling push with unknown keys should not warn by default', function () {
      noWarns(function () {
        run(function () {
          store.push('person', {
            id: '1',
            firstName: 'Tomster',
            emailAddress: 'tomster@emberjs.com',
            isMascot: true
          });
        });
      }, /The payload for 'person' contains these unknown keys: \[emailAddress,isMascot\]. Make sure they've been defined in your model./);
    });

    test('Calling pushMany is deprecated', function () {
      var person1, person2;
      expectDeprecation(function () {
        run(function () {
          person1 = { id: 1, firstName: 'John', lastName: 'Smith' };
          person2 = { id: 2, firstName: 'Suzie', lastName: 'Q' };

          store.pushMany('person', [person1, person2]);
        });
      }, 'Using store.pushMany() has been deprecated since store.push() now handles multiple items. You should use store.push() instead.');
    });

    test('Calling push(type, data) is deprecated', function () {
      var person1;
      expectDeprecation(function () {
        run(function () {
          person1 = { id: 1, firstName: 'John', lastName: 'Smith' };

          store.push('person', person1);
        });
      }, /store.push\(type, data\) has been deprecated/);
    });

    module('unit/store/push - DS.Store#push with JSON-API', {
      setup: function () {
        var Person = DS.Model.extend({
          name: DS.attr('string'),
          cars: DS.hasMany('car', { async: false })
        });

        Person.toString = function () {
          return 'Person';
        };

        var Car = DS.Model.extend({
          make: DS.attr('string'),
          model: DS.attr('string'),
          person: DS.belongsTo('person', { async: false })
        });

        Car.toString = function () {
          return 'Car';
        };

        env = setupStore({
          adapter: DS.Adapter,
          car: Car,
          person: Person
        });
        store = env.store;
      },

      teardown: function () {
        run(function () {
          store.destroy();
        });
      }
    });

    test('Should support pushing multiple models into the store', function () {
      expect(2);

      run(function () {
        store.push({
          data: [{
            type: 'person',
            id: 1,
            attributes: {
              name: 'Tom Dale'
            }
          }, {
            type: 'person',
            id: 2,
            attributes: {
              name: 'Tomster'
            }
          }]
        });
      });

      var tom = store.peekRecord('person', 1);
      equal(tom.get('name'), 'Tom Dale', 'Tom should be in the store');

      var tomster = store.peekRecord('person', 2);
      equal(tomster.get('name'), 'Tomster', 'Tomster should be in the store');
    });

    test('Should support pushing included models into the store', function () {
      expect(2);

      run(function () {
        store.push({
          data: [{
            type: 'person',
            id: 1,
            attributes: {
              name: 'Tomster'
            },
            relationships: {
              cars: [{
                data: {
                  type: 'person', id: 1
                }
              }]
            }
          }],
          included: [{
            type: 'car',
            id: 1,
            attributes: {
              make: 'Dodge',
              model: 'Neon'
            },
            relationships: {
              person: {
                data: {
                  id: 1, type: 'person'
                }
              }
            }
          }]
        });
      });

      var tomster = store.peekRecord('person', 1);
      equal(tomster.get('name'), 'Tomster', 'Tomster should be in the store');

      var car = store.peekRecord('car', 1);
      equal(car.get('model'), 'Neon', 'Tomster\'s car should be in the store');
    });
  }
);


define(
  "ember-data/tests/unit/store/serializer-for-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var container, store, registry;
    var run = Ember.run;

    module("unit/store/serializer_for - DS.Store#serializerFor", {
      setup: function () {
        var env = setupStore({ person: DS.Model.extend() });
        store = env.store;
        container = store.container;
        registry = env.registry;
      },

      teardown: function () {
        run(function () {
          container.destroy();
          store.destroy();
        });
      }
    });

    test("Calling serializerFor looks up 'serializer:<type>' from the container", function () {
      var PersonSerializer = DS.JSONSerializer.extend();

      registry.register("serializer:person", PersonSerializer);

      ok(store.serializerFor("person") instanceof PersonSerializer, "serializer returned from serializerFor is an instance of the registered Serializer class");
    });

    test("Calling serializerFor with a type that has not been registered looks up the default ApplicationSerializer", function () {
      var ApplicationSerializer = DS.JSONSerializer.extend();

      registry.register("serializer:application", ApplicationSerializer);

      ok(store.serializerFor("person") instanceof ApplicationSerializer, "serializer returned from serializerFor is an instance of ApplicationSerializer");
    });

    test("Calling serializerFor with a type that has not been registered and in an application that does not have an ApplicationSerializer looks up the default Ember Data serializer", function () {
      ok(store.serializerFor("person") instanceof DS.JSONSerializer, "serializer returned from serializerFor is an instance of DS.JSONSerializer");
    });
  }
);


define(
  "ember-data/tests/unit/store/unload-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    var get = Ember.get;
    var run = Ember.run;
    var store, tryToFind, Record;

    module('unit/store/unload - Store unloading records', {
      setup: function () {

        Record = DS.Model.extend({
          title: DS.attr('string'),
          wasFetched: DS.attr('boolean')
        });
        store = createStore({
          adapter: DS.Adapter.extend({
            findRecord: function (store, type, id, snapshot) {
              tryToFind = true;
              return Ember.RSVP.resolve({ id: id, wasFetched: true });
            }
          }),
          record: Record
        });
      },

      teardown: function () {
        Ember.run(store, 'destroy');
      }
    });

    test('unload a dirty record', function () {
      expect(2);

      run(function () {
        store.push('record', {
          id: 1,
          title: 'toto'
        });

        store.findRecord('record', 1).then(function (record) {
          record.set('title', 'toto2');
          record._internalModel.send('willCommit');

          equal(get(record, 'hasDirtyAttributes'), true, 'record is dirty');

          expectAssertion(function () {
            record.unloadRecord();
          }, 'You can only unload a record which is not inFlight. `' + Ember.inspect(record) + '`', 'can not unload dirty record');

          // force back into safe to unload mode.
          run(function () {
            record._internalModel.transitionTo('deleted.saved');
          });
        });
      });
    });

    test('unload a record', function () {
      expect(5);

      run(function () {
        store.push('record', { id: 1, title: 'toto' });
        store.findRecord('record', 1).then(function (record) {
          equal(get(record, 'id'), 1, 'found record with id 1');
          equal(get(record, 'hasDirtyAttributes'), false, 'record is not dirty');

          run(function () {
            store.unloadRecord(record);
          });

          equal(get(record, 'hasDirtyAttributes'), false, 'record is not dirty');
          equal(get(record, 'isDeleted'), true, 'record is deleted');

          tryToFind = false;
          return store.findRecord('record', 1).then(function () {
            equal(tryToFind, true, 'not found record with id 1');
          });
        });
      });
    });

    module('DS.Store - unload record with relationships');

    test('can commit store after unload record with relationships', function () {
      expect(1);

      var like, product;

      var Brand = DS.Model.extend({
        name: DS.attr('string')
      });

      var Product = DS.Model.extend({
        description: DS.attr('string'),
        brand: DS.belongsTo('brand', { async: false })
      });

      var Like = DS.Model.extend({
        product: DS.belongsTo('product', { async: false })
      });

      var store = createStore({
        adapter: DS.Adapter.extend({
          findRecord: function (store, type, id, snapshot) {
            return Ember.RSVP.resolve({ id: 1, description: 'cuisinart', brand: 1 });
          },
          createRecord: function (store, type, snapshot) {
            return Ember.RSVP.resolve();
          }
        }),
        brand: Brand,
        product: Product,
        like: Like
      });
      var asyncRecords;

      run(function () {
        store.push('brand', { id: 1, name: 'EmberJS' });
        store.push('product', { id: 1, description: 'toto', brand: 1 });
        asyncRecords = Ember.RSVP.hash({
          brand: store.findRecord('brand', 1),
          product: store.findRecord('product', 1)
        });
        asyncRecords.then(function (records) {
          like = store.createRecord('like', { id: 1, product: product });
          records.like = like.save();
          return Ember.RSVP.hash(records);
        }).then(function (records) {
          store.unloadRecord(records.product);
          return store.findRecord('product', 1);
        }).then(function (product) {
          equal(product.get('description'), 'cuisinart', 'The record was unloaded and the adapter\'s `findRecord` was called');
          store.destroy();
        });
      });
    });
  }
);


define(
  "ember-data/tests/unit/transform/boolean-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    module("unit/transform - DS.BooleanTransform");

    test("#serialize", function () {
      var transform = new DS.BooleanTransform();

      equal(transform.serialize(null), false);
      equal(transform.serialize(undefined), false);

      equal(transform.serialize(true), true);
      equal(transform.serialize(false), false);
    });

    test("#deserialize", function () {
      var transform = new DS.BooleanTransform();

      equal(transform.deserialize(null), false);
      equal(transform.deserialize(undefined), false);

      equal(transform.deserialize(true), true);
      equal(transform.deserialize(false), false);

      equal(transform.deserialize("true"), true);
      equal(transform.deserialize("TRUE"), true);
      equal(transform.deserialize("false"), false);
      equal(transform.deserialize("FALSE"), false);

      equal(transform.deserialize("t"), true);
      equal(transform.deserialize("T"), true);
      equal(transform.deserialize("f"), false);
      equal(transform.deserialize("F"), false);

      equal(transform.deserialize("1"), true);
      equal(transform.deserialize("0"), false);

      equal(transform.deserialize(1), true);
      equal(transform.deserialize(2), false);
      equal(transform.deserialize(0), false);
    });
  }
);


define(
  "ember-data/tests/unit/transform/date-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    module("unit/transform - DS.DateTransform");

    var dateString = "2015-01-01T00:00:00.000Z";
    var dateInMillis = Ember.Date.parse(dateString);
    var date = new Date(dateInMillis);

    test("#serialize", function () {
      var transform = new DS.DateTransform();

      equal(transform.serialize(null), null);
      equal(transform.serialize(undefined), null);

      equal(transform.serialize(date), dateString);
    });

    test("#deserialize", function () {
      var transform = new DS.DateTransform();

      // from String
      equal(transform.deserialize(dateString).toISOString(), dateString);

      // from Number
      equal(transform.deserialize(dateInMillis).valueOf(), dateInMillis);

      // from other
      equal(transform.deserialize({}), null);

      // from none
      equal(transform.deserialize(null), null);
      equal(transform.deserialize(undefined), null);
    });
  }
);


/* jshint -W053 */

define(
  "ember-data/tests/unit/transform/number-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    module("unit/transform - DS.NumberTransform");

    test("#serialize", function () {
      var transform = new DS.NumberTransform();

      equal(transform.serialize(null), null);
      equal(transform.serialize(undefined), null);
      equal(transform.serialize("1.1"), 1.1);
      equal(transform.serialize(1.1), 1.1);
      equal(transform.serialize(new Number(1.1)), 1.1);
      equal(transform.serialize(NaN), null);
      equal(transform.serialize(Infinity), null);
      equal(transform.serialize(-Infinity), null);
    });

    test("#deserialize", function () {
      var transform = new DS.NumberTransform();

      equal(transform.deserialize(null), null);
      equal(transform.deserialize(undefined), null);
      equal(transform.deserialize("1.1"), 1.1);
      equal(transform.deserialize(1.1), 1.1);
      equal(transform.deserialize(new Number(1.1)), 1.1);
      equal(transform.deserialize(NaN), null);
      equal(transform.deserialize(Infinity), null);
      equal(transform.deserialize(-Infinity), null);
    });
  }
);


define(
  "ember-data/tests/unit/transform/string-test",
  ["exports"],
  function(__exports__) {
    "use strict";

    function __es6_export__(name, value) {
      __exports__[name] = value;
    }

    module("unit/transform - DS.StringTransform");

    test("#serialize", function () {
      var transform = new DS.StringTransform();

      equal(transform.serialize(null), null);
      equal(transform.serialize(undefined), null);

      equal(transform.serialize("foo"), "foo");
      equal(transform.serialize(1), "1");
    });

    test("#deserialize", function () {
      var transform = new DS.StringTransform();

      equal(transform.deserialize(null), null);
      equal(transform.deserialize(undefined), null);

      equal(transform.deserialize("foo"), "foo");
      equal(transform.deserialize(1), "1");
    });
  }
);


// TODO enable import once this is possible
// import { assertPolymorphicType } from "ember-data/utils";

define("ember-data/tests/unit/utils-test", ["exports"], function(__exports__) {
  "use strict";

  function __es6_export__(name, value) {
    __exports__[name] = value;
  }

  var env, User, Message, Post, Person, Video, Medium;

  module('unit/utils', {
    setup: function () {
      Person = DS.Model.extend();
      User = DS.Model.extend({
        messages: DS.hasMany('message', { async: false })
      });

      Message = DS.Model.extend();
      Post = Message.extend({
        medias: DS.hasMany('medium', { async: false })
      });

      Medium = Ember.Mixin.create();
      Video = DS.Model.extend(Medium);

      env = setupStore({
        user: User,
        person: Person,
        message: Message,
        post: Post,
        video: Video
      });

      env.registry.register('mixin:medium', Medium);
    },

    teardown: function () {
      Ember.run(env.container, 'destroy');
    }
  });

  test('assertPolymorphicType works for subclasses', function () {
    var user, post, person;

    Ember.run(function () {
      user = env.store.push('user', { id: 1, messages: [] });
      post = env.store.push('post', { id: 1 });
      person = env.store.push('person', { id: 1 });
    });

    // TODO un-comment once we test the assertPolymorphicType directly
    // var relationship = user.relationshipFor('messages');
    // user = user._internalModel;
    // post = post._internalModel;
    // person = person._internalModel;

    try {
      Ember.run(function () {
        user.get('messages').addObject(post);
      });

      // TODO enable once we can do "import { assertPolymorphicType } from "ember-data/utils"
      // assertPolymorphicType(user, relationship, post);
    } catch (e) {
      ok(false, 'should not throw an error');
    }

    expectAssertion(function () {
      Ember.run(function () {
        user.get('messages').addObject(person);
      });

      // TODO enable once we can do "import { assertPolymorphicType } from "ember-data/utils"
      // assertPolymorphicType(user, relationship, person);
    }, 'You cannot add a record of type \'person\' to the \'user.messages\' relationship (only \'message\' allowed)');
  });

  test('assertPolymorphicType works for mixins', function () {
    var post, video, person;

    Ember.run(function () {
      post = env.store.push('post', { id: 1 });
      video = env.store.push('video', { id: 1 });
      person = env.store.push('person', { id: 1 });
    });

    // TODO un-comment once we test the assertPolymorphicType directly
    // var relationship = post.relationshipFor('medias');
    // post = post._internalModel;
    // video = video._internalModel;
    // person = person._internalModel;

    try {
      Ember.run(function () {
        post.get('medias').addObject(video);
      });

      // TODO enable once we can do "import { assertPolymorphicType } from "ember-data/utils"
      // assertPolymorphicType(post, relationship, video);
    } catch (e) {
      ok(false, 'should not throw an error');
    }

    expectAssertion(function () {
      Ember.run(function () {
        post.get('medias').addObject(person);
      });

      // TODO enable once we can do "import { assertPolymorphicType } from "ember-data/utils"
      // assertPolymorphicType(post, relationship, person);
    }, 'You cannot add a record of type \'person\' to the \'post.medias\' relationship (only \'medium\' allowed)');
  });
});


if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib');
test('ember-data/lib/adapters.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/adapters.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/adapters');
test('ember-data/lib/adapters/build-url-mixin.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/adapters/build-url-mixin.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/adapters');
test('ember-data/lib/adapters/errors.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/adapters/errors.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/adapters');
test('ember-data/lib/adapters/fixture-adapter.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/adapters/fixture-adapter.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/adapters');
test('ember-data/lib/adapters/json-api-adapter.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/adapters/json-api-adapter.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/adapters');
test('ember-data/lib/adapters/rest-adapter.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/adapters/rest-adapter.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib');
test('ember-data/lib/core.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/core.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib');
test('ember-data/lib/ember-initializer.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/ember-initializer.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/ext');
test('ember-data/lib/ext/date.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/ext/date.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/initializers');
test('ember-data/lib/initializers/data-adapter.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/initializers/data-adapter.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/initializers');
test('ember-data/lib/initializers/store-injections.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/initializers/store-injections.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/initializers');
test('ember-data/lib/initializers/store.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/initializers/store.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/initializers');
test('ember-data/lib/initializers/transforms.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/initializers/transforms.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/instance-initializers');
test('ember-data/lib/instance-initializers/initialize-store-service.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/instance-initializers/initialize-store-service.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib');
test('ember-data/lib/main.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/main.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib');
test('ember-data/lib/serializers.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/serializers.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/serializers');
test('ember-data/lib/serializers/embedded-records-mixin.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/serializers/embedded-records-mixin.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/serializers');
test('ember-data/lib/serializers/json-api-serializer.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/serializers/json-api-serializer.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/serializers');
test('ember-data/lib/serializers/json-serializer.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/serializers/json-serializer.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/serializers');
test('ember-data/lib/serializers/rest-serializer.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/serializers/rest-serializer.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib');
test('ember-data/lib/setup-container.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/setup-container.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/adapter.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/adapter.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/clone-null.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/clone-null.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/coerce-id.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/coerce-id.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/container-proxy.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/container-proxy.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/debug.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/debug.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/debug');
test('ember-data/lib/system/debug/debug-adapter.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/debug/debug-adapter.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/debug');
test('ember-data/lib/system/debug/debug-info.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/debug/debug-info.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/many-array.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/many-array.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/map.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/map.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/merge.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/merge.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/model.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/model.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/model');
test('ember-data/lib/system/model/attributes.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/model/attributes.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/model');
test('ember-data/lib/system/model/errors.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/model/errors.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/model/errors');
test('ember-data/lib/system/model/errors/invalid.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/model/errors/invalid.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/model');
test('ember-data/lib/system/model/internal-model.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/model/internal-model.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/model');
test('ember-data/lib/system/model/model.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/model/model.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/model');
test('ember-data/lib/system/model/states.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/model/states.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/normalize-model-name.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/normalize-model-name.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/ordered-set.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/ordered-set.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/promise-proxies.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/promise-proxies.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/record-array-manager.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/record-array-manager.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/record-arrays.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/record-arrays.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/record-arrays');
test('ember-data/lib/system/record-arrays/adapter-populated-record-array.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/record-arrays/adapter-populated-record-array.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/record-arrays');
test('ember-data/lib/system/record-arrays/filtered-record-array.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/record-arrays/filtered-record-array.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/record-arrays');
test('ember-data/lib/system/record-arrays/record-array.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/record-arrays/record-array.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/relationship-meta.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/relationship-meta.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/relationships.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/relationships.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/relationships');
test('ember-data/lib/system/relationships/belongs-to.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/relationships/belongs-to.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/relationships');
test('ember-data/lib/system/relationships/ext.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/relationships/ext.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/relationships');
test('ember-data/lib/system/relationships/has-many.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/relationships/has-many.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/relationships/state');
test('ember-data/lib/system/relationships/state/belongs-to.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/relationships/state/belongs-to.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/relationships/state');
test('ember-data/lib/system/relationships/state/create.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/relationships/state/create.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/relationships/state');
test('ember-data/lib/system/relationships/state/has-many.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/relationships/state/has-many.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/relationships/state');
test('ember-data/lib/system/relationships/state/relationship.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/relationships/state/relationship.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/serializer.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/serializer.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/snapshot-record-array.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/snapshot-record-array.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/snapshot.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/snapshot.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system');
test('ember-data/lib/system/store.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/store.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/store');
test('ember-data/lib/system/store/common.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/store/common.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/store');
test('ember-data/lib/system/store/container-instance-cache.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/store/container-instance-cache.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/store');
test('ember-data/lib/system/store/finders.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/store/finders.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/store');
test('ember-data/lib/system/store/serializer-response.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/store/serializer-response.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/system/store');
test('ember-data/lib/system/store/serializers.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/system/store/serializers.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib');
test('ember-data/lib/transforms.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/transforms.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/transforms');
test('ember-data/lib/transforms/base.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/transforms/base.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/transforms');
test('ember-data/lib/transforms/boolean.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/transforms/boolean.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/transforms');
test('ember-data/lib/transforms/date.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/transforms/date.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/transforms');
test('ember-data/lib/transforms/number.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/transforms/number.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib/transforms');
test('ember-data/lib/transforms/string.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/transforms/string.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/lib');
test('ember-data/lib/utils.js should pass jshint', function() { 
  ok(true, 'ember-data/lib/utils.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/helpers');
test('ember-data/tests/helpers/custom-adapter.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/helpers/custom-adapter.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/adapter');
test('ember-data/tests/integration/adapter/build-url-mixin-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/adapter/build-url-mixin-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/adapter');
test('ember-data/tests/integration/adapter/find-all-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/adapter/find-all-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/adapter');
test('ember-data/tests/integration/adapter/find-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/adapter/find-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/adapter');
test('ember-data/tests/integration/adapter/json-api-adapter-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/adapter/json-api-adapter-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/adapter');
test('ember-data/tests/integration/adapter/queries-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/adapter/queries-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/adapter');
test('ember-data/tests/integration/adapter/record-persistence-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/adapter/record-persistence-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/adapter');
test('ember-data/tests/integration/adapter/rest-adapter-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/adapter/rest-adapter-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/adapter');
test('ember-data/tests/integration/adapter/serialize-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/adapter/serialize-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/adapter');
test('ember-data/tests/integration/adapter/store-adapter-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/adapter/store-adapter-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/application-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/application-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/backwards-compat');
test('ember-data/tests/integration/backwards-compat/deprecate-type-key-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/backwards-compat/deprecate-type-key-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/backwards-compat');
test('ember-data/tests/integration/backwards-compat/non-dasherized-lookups.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/backwards-compat/non-dasherized-lookups.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/client-id-generation-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/client-id-generation-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/debug-adapter-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/debug-adapter-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/filter-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/filter-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/inverse-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/inverse-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/lifecycle-hooks-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/lifecycle-hooks-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/multiple_stores_test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/multiple_stores_test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/peek-all-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/peek-all-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/record-array-manager-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/record-array-manager-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/records');
test('ember-data/tests/integration/records/collection-save-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/records/collection-save-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/records');
test('ember-data/tests/integration/records/delete-record-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/records/delete-record-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/records');
test('ember-data/tests/integration/records/load-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/records/load-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/records');
test('ember-data/tests/integration/records/property-changes-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/records/property-changes-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/records');
test('ember-data/tests/integration/records/reload-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/records/reload-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/records');
test('ember-data/tests/integration/records/save-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/records/save-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/records');
test('ember-data/tests/integration/records/unload-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/records/unload-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/relationships');
test('ember-data/tests/integration/relationships/belongs-to-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/relationships/belongs-to-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/relationships');
test('ember-data/tests/integration/relationships/has-many-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/relationships/has-many-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/relationships');
test('ember-data/tests/integration/relationships/inverse-relationships-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/relationships/inverse-relationships-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/relationships');
test('ember-data/tests/integration/relationships/many-to-many-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/relationships/many-to-many-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/relationships');
test('ember-data/tests/integration/relationships/one-to-many-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/relationships/one-to-many-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/relationships');
test('ember-data/tests/integration/relationships/one-to-one-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/relationships/one-to-one-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/relationships');
test('ember-data/tests/integration/relationships/polymorphic-mixins-belongs-to-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/relationships/polymorphic-mixins-belongs-to-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/relationships');
test('ember-data/tests/integration/relationships/polymorphic-mixins-has-many-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/relationships/polymorphic-mixins-has-many-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/serializers');
test('ember-data/tests/integration/serializers/embedded-records-mixin-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/serializers/embedded-records-mixin-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/serializers');
test('ember-data/tests/integration/serializers/json-api-serializer-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/serializers/json-api-serializer-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/serializers');
test('ember-data/tests/integration/serializers/json-serializer-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/serializers/json-serializer-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/serializers');
test('ember-data/tests/integration/serializers/rest-serializer-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/serializers/rest-serializer-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/setup-container-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/setup-container-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/snapshot-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/snapshot-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration');
test('ember-data/tests/integration/store-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/store-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/integration/store');
test('ember-data/tests/integration/store/query-record-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/integration/store/query-record-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit');
test('ember-data/tests/unit/adapter-errors-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/adapter-errors-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit');
test('ember-data/tests/unit/adapter-populated-record-array-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/adapter-populated-record-array-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/adapters/build-url-mixin');
test('ember-data/tests/unit/adapters/build-url-mixin/path-for-type-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/adapters/build-url-mixin/path-for-type-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/adapters/json-api-adapter');
test('ember-data/tests/unit/adapters/json-api-adapter/ajax-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/adapters/json-api-adapter/ajax-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/adapters/rest-adapter');
test('ember-data/tests/unit/adapters/rest-adapter/ajax-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/adapters/rest-adapter/ajax-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/adapters/rest-adapter');
test('ember-data/tests/unit/adapters/rest-adapter/deprecated-adapter-methods.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/adapters/rest-adapter/deprecated-adapter-methods.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/adapters/rest-adapter');
test('ember-data/tests/unit/adapters/rest-adapter/group-records-for-find-many-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/adapters/rest-adapter/group-records-for-find-many-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit');
test('ember-data/tests/unit/debug-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/debug-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit');
test('ember-data/tests/unit/many-array-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/many-array-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit');
test('ember-data/tests/unit/model-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/model');
test('ember-data/tests/unit/model/errors-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model/errors-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/model');
test('ember-data/tests/unit/model/internal-model-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model/internal-model-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/model');
test('ember-data/tests/unit/model/lifecycle-callbacks-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model/lifecycle-callbacks-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/model');
test('ember-data/tests/unit/model/merge-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model/merge-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/model');
test('ember-data/tests/unit/model/relationships-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model/relationships-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/model/relationships');
test('ember-data/tests/unit/model/relationships/belongs-to-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model/relationships/belongs-to-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/model/relationships');
test('ember-data/tests/unit/model/relationships/has-many-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model/relationships/has-many-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/model/relationships');
test('ember-data/tests/unit/model/relationships/record-array-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model/relationships/record-array-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/model');
test('ember-data/tests/unit/model/rollback-attributes-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/model/rollback-attributes-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit');
test('ember-data/tests/unit/promise-proxies-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/promise-proxies-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit');
test('ember-data/tests/unit/record-array-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/record-array-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/record-arrays');
test('ember-data/tests/unit/record-arrays/filtered-record-array-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/record-arrays/filtered-record-array-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit');
test('ember-data/tests/unit/states-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/states-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/adapter-interop-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/adapter-interop-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/create-record-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/create-record-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/has_record_for_id_test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/has_record_for_id_test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/lookup-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/lookup-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/metadata-for-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/metadata-for-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/model-for-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/model-for-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/peek-record-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/peek-record-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/push-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/push-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/serializer-for-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/serializer-for-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/store');
test('ember-data/tests/unit/store/unload-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/store/unload-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/transform');
test('ember-data/tests/unit/transform/boolean-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/transform/boolean-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/transform');
test('ember-data/tests/unit/transform/date-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/transform/date-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/transform');
test('ember-data/tests/unit/transform/number-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/transform/number-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit/transform');
test('ember-data/tests/unit/transform/string-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/transform/string-test.js should pass jshint.'); 
});

}
if (!QUnit.urlParams.nojshint) {
module('JSHint - ember-data/tests/unit');
test('ember-data/tests/unit/utils-test.js should pass jshint', function() { 
  ok(true, 'ember-data/tests/unit/utils-test.js should pass jshint.'); 
});

}//# sourceMappingURL=ember-data-tests.map