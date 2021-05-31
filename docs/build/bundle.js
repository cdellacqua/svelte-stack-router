
(function(l, r) { if (l.getElementById('livereloadscript')) return; r = l.createElement('script'); r.async = 1; r.src = '//' + (window.location.host || 'localhost').split(':')[0] + ':35729/livereload.js?snipver=1'; r.id = 'livereloadscript'; l.getElementsByTagName('head')[0].appendChild(r) })(window.document);
var StackRouter = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
    function add_location(element, file, line, column, char) {
        element.__svelte_meta = {
            loc: { file, line, column, char }
        };
    }
    function run(fn) {
        return fn();
    }
    function blank_object() {
        return Object.create(null);
    }
    function run_all(fns) {
        fns.forEach(run);
    }
    function is_function(thing) {
        return typeof thing === 'function';
    }
    function safe_not_equal(a, b) {
        return a != a ? b == b : a !== b || ((a && typeof a === 'object') || typeof a === 'function');
    }
    function is_empty(obj) {
        return Object.keys(obj).length === 0;
    }
    function validate_store(store, name) {
        if (store != null && typeof store.subscribe !== 'function') {
            throw new Error(`'${name}' is not a store with a 'subscribe' method`);
        }
    }
    function subscribe(store, ...callbacks) {
        if (store == null) {
            return noop;
        }
        const unsub = store.subscribe(...callbacks);
        return unsub.unsubscribe ? () => unsub.unsubscribe() : unsub;
    }
    function get_store_value(store) {
        let value;
        subscribe(store, _ => value = _)();
        return value;
    }
    function component_subscribe(component, store, callback) {
        component.$$.on_destroy.push(subscribe(store, callback));
    }
    function action_destroyer(action_result) {
        return action_result && is_function(action_result.destroy) ? action_result.destroy : noop;
    }

    const is_client = typeof window !== 'undefined';
    let now = is_client
        ? () => window.performance.now()
        : () => Date.now();
    let raf = is_client ? cb => requestAnimationFrame(cb) : noop;

    const tasks = new Set();
    function run_tasks(now) {
        tasks.forEach(task => {
            if (!task.c(now)) {
                tasks.delete(task);
                task.f();
            }
        });
        if (tasks.size !== 0)
            raf(run_tasks);
    }
    /**
     * Creates a new task that runs on each raf frame
     * until it returns a falsy value or is aborted
     */
    function loop(callback) {
        let task;
        if (tasks.size === 0)
            raf(run_tasks);
        return {
            promise: new Promise(fulfill => {
                tasks.add(task = { c: callback, f: fulfill });
            }),
            abort() {
                tasks.delete(task);
            }
        };
    }

    function append(target, node) {
        target.appendChild(node);
    }
    function insert(target, node, anchor) {
        target.insertBefore(node, anchor || null);
    }
    function detach(node) {
        node.parentNode.removeChild(node);
    }
    function destroy_each(iterations, detaching) {
        for (let i = 0; i < iterations.length; i += 1) {
            if (iterations[i])
                iterations[i].d(detaching);
        }
    }
    function element(name) {
        return document.createElement(name);
    }
    function text(data) {
        return document.createTextNode(data);
    }
    function space() {
        return text(' ');
    }
    function listen(node, event, handler, options) {
        node.addEventListener(event, handler, options);
        return () => node.removeEventListener(event, handler, options);
    }
    function attr(node, attribute, value) {
        if (value == null)
            node.removeAttribute(attribute);
        else if (node.getAttribute(attribute) !== value)
            node.setAttribute(attribute, value);
    }
    function children(element) {
        return Array.from(element.childNodes);
    }
    function set_style(node, key, value, important) {
        node.style.setProperty(key, value, important ? 'important' : '');
    }
    function select_option(select, value) {
        for (let i = 0; i < select.options.length; i += 1) {
            const option = select.options[i];
            if (option.__value === value) {
                option.selected = true;
                return;
            }
        }
    }
    function select_value(select) {
        const selected_option = select.querySelector(':checked') || select.options[0];
        return selected_option && selected_option.__value;
    }
    // unfortunately this can't be a constant as that wouldn't be tree-shakeable
    // so we cache the result instead
    let crossorigin;
    function is_crossorigin() {
        if (crossorigin === undefined) {
            crossorigin = false;
            try {
                if (typeof window !== 'undefined' && window.parent) {
                    void window.parent.document;
                }
            }
            catch (error) {
                crossorigin = true;
            }
        }
        return crossorigin;
    }
    function add_resize_listener(node, fn) {
        const computed_style = getComputedStyle(node);
        if (computed_style.position === 'static') {
            node.style.position = 'relative';
        }
        const iframe = element('iframe');
        iframe.setAttribute('style', 'display: block; position: absolute; top: 0; left: 0; width: 100%; height: 100%; ' +
            'overflow: hidden; border: 0; opacity: 0; pointer-events: none; z-index: -1;');
        iframe.setAttribute('aria-hidden', 'true');
        iframe.tabIndex = -1;
        const crossorigin = is_crossorigin();
        let unsubscribe;
        if (crossorigin) {
            iframe.src = "data:text/html,<script>onresize=function(){parent.postMessage(0,'*')}</script>";
            unsubscribe = listen(window, 'message', (event) => {
                if (event.source === iframe.contentWindow)
                    fn();
            });
        }
        else {
            iframe.src = 'about:blank';
            iframe.onload = () => {
                unsubscribe = listen(iframe.contentWindow, 'resize', fn);
            };
        }
        append(node, iframe);
        return () => {
            if (crossorigin) {
                unsubscribe();
            }
            else if (unsubscribe && iframe.contentWindow) {
                unsubscribe();
            }
            detach(iframe);
        };
    }
    function custom_event(type, detail) {
        const e = document.createEvent('CustomEvent');
        e.initCustomEvent(type, false, false, detail);
        return e;
    }

    const active_docs = new Set();
    let active = 0;
    // https://github.com/darkskyapp/string-hash/blob/master/index.js
    function hash(str) {
        let hash = 5381;
        let i = str.length;
        while (i--)
            hash = ((hash << 5) - hash) ^ str.charCodeAt(i);
        return hash >>> 0;
    }
    function create_rule(node, a, b, duration, delay, ease, fn, uid = 0) {
        const step = 16.666 / duration;
        let keyframes = '{\n';
        for (let p = 0; p <= 1; p += step) {
            const t = a + (b - a) * ease(p);
            keyframes += p * 100 + `%{${fn(t, 1 - t)}}\n`;
        }
        const rule = keyframes + `100% {${fn(b, 1 - b)}}\n}`;
        const name = `__svelte_${hash(rule)}_${uid}`;
        const doc = node.ownerDocument;
        active_docs.add(doc);
        const stylesheet = doc.__svelte_stylesheet || (doc.__svelte_stylesheet = doc.head.appendChild(element('style')).sheet);
        const current_rules = doc.__svelte_rules || (doc.__svelte_rules = {});
        if (!current_rules[name]) {
            current_rules[name] = true;
            stylesheet.insertRule(`@keyframes ${name} ${rule}`, stylesheet.cssRules.length);
        }
        const animation = node.style.animation || '';
        node.style.animation = `${animation ? `${animation}, ` : ''}${name} ${duration}ms linear ${delay}ms 1 both`;
        active += 1;
        return name;
    }
    function delete_rule(node, name) {
        const previous = (node.style.animation || '').split(', ');
        const next = previous.filter(name
            ? anim => anim.indexOf(name) < 0 // remove specific animation
            : anim => anim.indexOf('__svelte') === -1 // remove all Svelte animations
        );
        const deleted = previous.length - next.length;
        if (deleted) {
            node.style.animation = next.join(', ');
            active -= deleted;
            if (!active)
                clear_rules();
        }
    }
    function clear_rules() {
        raf(() => {
            if (active)
                return;
            active_docs.forEach(doc => {
                const stylesheet = doc.__svelte_stylesheet;
                let i = stylesheet.cssRules.length;
                while (i--)
                    stylesheet.deleteRule(i);
                doc.__svelte_rules = {};
            });
            active_docs.clear();
        });
    }

    let current_component;
    function set_current_component(component) {
        current_component = component;
    }
    function get_current_component() {
        if (!current_component)
            throw new Error('Function called outside component initialization');
        return current_component;
    }
    function onMount(fn) {
        get_current_component().$$.on_mount.push(fn);
    }
    function onDestroy(fn) {
        get_current_component().$$.on_destroy.push(fn);
    }
    function createEventDispatcher() {
        const component = get_current_component();
        return (type, detail) => {
            const callbacks = component.$$.callbacks[type];
            if (callbacks) {
                // TODO are there situations where events could be dispatched
                // in a server (non-DOM) environment?
                const event = custom_event(type, detail);
                callbacks.slice().forEach(fn => {
                    fn.call(component, event);
                });
            }
        };
    }

    const dirty_components = [];
    const binding_callbacks = [];
    const render_callbacks = [];
    const flush_callbacks = [];
    const resolved_promise = Promise.resolve();
    let update_scheduled = false;
    function schedule_update() {
        if (!update_scheduled) {
            update_scheduled = true;
            resolved_promise.then(flush);
        }
    }
    function tick() {
        schedule_update();
        return resolved_promise;
    }
    function add_render_callback(fn) {
        render_callbacks.push(fn);
    }
    let flushing = false;
    const seen_callbacks = new Set();
    function flush() {
        if (flushing)
            return;
        flushing = true;
        do {
            // first, call beforeUpdate functions
            // and update components
            for (let i = 0; i < dirty_components.length; i += 1) {
                const component = dirty_components[i];
                set_current_component(component);
                update(component.$$);
            }
            set_current_component(null);
            dirty_components.length = 0;
            while (binding_callbacks.length)
                binding_callbacks.pop()();
            // then, once components are updated, call
            // afterUpdate functions. This may cause
            // subsequent updates...
            for (let i = 0; i < render_callbacks.length; i += 1) {
                const callback = render_callbacks[i];
                if (!seen_callbacks.has(callback)) {
                    // ...so guard against infinite loops
                    seen_callbacks.add(callback);
                    callback();
                }
            }
            render_callbacks.length = 0;
        } while (dirty_components.length);
        while (flush_callbacks.length) {
            flush_callbacks.pop()();
        }
        update_scheduled = false;
        flushing = false;
        seen_callbacks.clear();
    }
    function update($$) {
        if ($$.fragment !== null) {
            $$.update();
            run_all($$.before_update);
            const dirty = $$.dirty;
            $$.dirty = [-1];
            $$.fragment && $$.fragment.p($$.ctx, dirty);
            $$.after_update.forEach(add_render_callback);
        }
    }

    let promise;
    function wait() {
        if (!promise) {
            promise = Promise.resolve();
            promise.then(() => {
                promise = null;
            });
        }
        return promise;
    }
    function dispatch(node, direction, kind) {
        node.dispatchEvent(custom_event(`${direction ? 'intro' : 'outro'}${kind}`));
    }
    const outroing = new Set();
    let outros;
    function group_outros() {
        outros = {
            r: 0,
            c: [],
            p: outros // parent group
        };
    }
    function check_outros() {
        if (!outros.r) {
            run_all(outros.c);
        }
        outros = outros.p;
    }
    function transition_in(block, local) {
        if (block && block.i) {
            outroing.delete(block);
            block.i(local);
        }
    }
    function transition_out(block, local, detach, callback) {
        if (block && block.o) {
            if (outroing.has(block))
                return;
            outroing.add(block);
            outros.c.push(() => {
                outroing.delete(block);
                if (callback) {
                    if (detach)
                        block.d(1);
                    callback();
                }
            });
            block.o(local);
        }
    }
    const null_transition = { duration: 0 };
    function create_bidirectional_transition(node, fn, params, intro) {
        let config = fn(node, params);
        let t = intro ? 0 : 1;
        let running_program = null;
        let pending_program = null;
        let animation_name = null;
        function clear_animation() {
            if (animation_name)
                delete_rule(node, animation_name);
        }
        function init(program, duration) {
            const d = program.b - t;
            duration *= Math.abs(d);
            return {
                a: t,
                b: program.b,
                d,
                duration,
                start: program.start,
                end: program.start + duration,
                group: program.group
            };
        }
        function go(b) {
            const { delay = 0, duration = 300, easing = identity, tick = noop, css } = config || null_transition;
            const program = {
                start: now() + delay,
                b
            };
            if (!b) {
                // @ts-ignore todo: improve typings
                program.group = outros;
                outros.r += 1;
            }
            if (running_program || pending_program) {
                pending_program = program;
            }
            else {
                // if this is an intro, and there's a delay, we need to do
                // an initial tick and/or apply CSS animation immediately
                if (css) {
                    clear_animation();
                    animation_name = create_rule(node, t, b, duration, delay, easing, css);
                }
                if (b)
                    tick(0, 1);
                running_program = init(program, duration);
                add_render_callback(() => dispatch(node, b, 'start'));
                loop(now => {
                    if (pending_program && now > pending_program.start) {
                        running_program = init(pending_program, duration);
                        pending_program = null;
                        dispatch(node, running_program.b, 'start');
                        if (css) {
                            clear_animation();
                            animation_name = create_rule(node, t, running_program.b, running_program.duration, 0, easing, config.css);
                        }
                    }
                    if (running_program) {
                        if (now >= running_program.end) {
                            tick(t = running_program.b, 1 - t);
                            dispatch(node, running_program.b, 'end');
                            if (!pending_program) {
                                // we're done
                                if (running_program.b) {
                                    // intro — we can tidy up immediately
                                    clear_animation();
                                }
                                else {
                                    // outro — needs to be coordinated
                                    if (!--running_program.group.r)
                                        run_all(running_program.group.c);
                                }
                            }
                            running_program = null;
                        }
                        else if (now >= running_program.start) {
                            const p = now - running_program.start;
                            t = running_program.a + running_program.d * easing(p / running_program.duration);
                            tick(t, 1 - t);
                        }
                    }
                    return !!(running_program || pending_program);
                });
            }
        }
        return {
            run(b) {
                if (is_function(config)) {
                    wait().then(() => {
                        // @ts-ignore
                        config = config();
                        go(b);
                    });
                }
                else {
                    go(b);
                }
            },
            end() {
                clear_animation();
                running_program = pending_program = null;
            }
        };
    }

    const globals = (typeof window !== 'undefined'
        ? window
        : typeof globalThis !== 'undefined'
            ? globalThis
            : global);
    function create_component(block) {
        block && block.c();
    }
    function mount_component(component, target, anchor, customElement) {
        const { fragment, on_mount, on_destroy, after_update } = component.$$;
        fragment && fragment.m(target, anchor);
        if (!customElement) {
            // onMount happens before the initial afterUpdate
            add_render_callback(() => {
                const new_on_destroy = on_mount.map(run).filter(is_function);
                if (on_destroy) {
                    on_destroy.push(...new_on_destroy);
                }
                else {
                    // Edge case - component was destroyed immediately,
                    // most likely as a result of a binding initialising
                    run_all(new_on_destroy);
                }
                component.$$.on_mount = [];
            });
        }
        after_update.forEach(add_render_callback);
    }
    function destroy_component(component, detaching) {
        const $$ = component.$$;
        if ($$.fragment !== null) {
            run_all($$.on_destroy);
            $$.fragment && $$.fragment.d(detaching);
            // TODO null out other refs, including component.$$ (but need to
            // preserve final state?)
            $$.on_destroy = $$.fragment = null;
            $$.ctx = [];
        }
    }
    function make_dirty(component, i) {
        if (component.$$.dirty[0] === -1) {
            dirty_components.push(component);
            schedule_update();
            component.$$.dirty.fill(0);
        }
        component.$$.dirty[(i / 31) | 0] |= (1 << (i % 31));
    }
    function init(component, options, instance, create_fragment, not_equal, props, dirty = [-1]) {
        const parent_component = current_component;
        set_current_component(component);
        const $$ = component.$$ = {
            fragment: null,
            ctx: null,
            // state
            props,
            update: noop,
            not_equal,
            bound: blank_object(),
            // lifecycle
            on_mount: [],
            on_destroy: [],
            on_disconnect: [],
            before_update: [],
            after_update: [],
            context: new Map(parent_component ? parent_component.$$.context : options.context || []),
            // everything else
            callbacks: blank_object(),
            dirty,
            skip_bound: false
        };
        let ready = false;
        $$.ctx = instance
            ? instance(component, options.props || {}, (i, ret, ...rest) => {
                const value = rest.length ? rest[0] : ret;
                if ($$.ctx && not_equal($$.ctx[i], $$.ctx[i] = value)) {
                    if (!$$.skip_bound && $$.bound[i])
                        $$.bound[i](value);
                    if (ready)
                        make_dirty(component, i);
                }
                return ret;
            })
            : [];
        $$.update();
        ready = true;
        run_all($$.before_update);
        // `false` as a special case of no DOM component
        $$.fragment = create_fragment ? create_fragment($$.ctx) : false;
        if (options.target) {
            if (options.hydrate) {
                const nodes = children(options.target);
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.l(nodes);
                nodes.forEach(detach);
            }
            else {
                // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                $$.fragment && $$.fragment.c();
            }
            if (options.intro)
                transition_in(component.$$.fragment);
            mount_component(component, options.target, options.anchor, options.customElement);
            flush();
        }
        set_current_component(parent_component);
    }
    /**
     * Base class for Svelte components. Used when dev=false.
     */
    class SvelteComponent {
        $destroy() {
            destroy_component(this, 1);
            this.$destroy = noop;
        }
        $on(type, callback) {
            const callbacks = (this.$$.callbacks[type] || (this.$$.callbacks[type] = []));
            callbacks.push(callback);
            return () => {
                const index = callbacks.indexOf(callback);
                if (index !== -1)
                    callbacks.splice(index, 1);
            };
        }
        $set($$props) {
            if (this.$$set && !is_empty($$props)) {
                this.$$.skip_bound = true;
                this.$$set($$props);
                this.$$.skip_bound = false;
            }
        }
    }

    function dispatch_dev(type, detail) {
        document.dispatchEvent(custom_event(type, Object.assign({ version: '3.38.2' }, detail)));
    }
    function append_dev(target, node) {
        dispatch_dev('SvelteDOMInsert', { target, node });
        append(target, node);
    }
    function insert_dev(target, node, anchor) {
        dispatch_dev('SvelteDOMInsert', { target, node, anchor });
        insert(target, node, anchor);
    }
    function detach_dev(node) {
        dispatch_dev('SvelteDOMRemove', { node });
        detach(node);
    }
    function listen_dev(node, event, handler, options, has_prevent_default, has_stop_propagation) {
        const modifiers = options === true ? ['capture'] : options ? Array.from(Object.keys(options)) : [];
        if (has_prevent_default)
            modifiers.push('preventDefault');
        if (has_stop_propagation)
            modifiers.push('stopPropagation');
        dispatch_dev('SvelteDOMAddEventListener', { node, event, handler, modifiers });
        const dispose = listen(node, event, handler, options);
        return () => {
            dispatch_dev('SvelteDOMRemoveEventListener', { node, event, handler, modifiers });
            dispose();
        };
    }
    function attr_dev(node, attribute, value) {
        attr(node, attribute, value);
        if (value == null)
            dispatch_dev('SvelteDOMRemoveAttribute', { node, attribute });
        else
            dispatch_dev('SvelteDOMSetAttribute', { node, attribute, value });
    }
    function prop_dev(node, property, value) {
        node[property] = value;
        dispatch_dev('SvelteDOMSetProperty', { node, property, value });
    }
    function set_data_dev(text, data) {
        data = '' + data;
        if (text.wholeText === data)
            return;
        dispatch_dev('SvelteDOMSetData', { node: text, data });
        text.data = data;
    }
    function validate_each_argument(arg) {
        if (typeof arg !== 'string' && !(arg && typeof arg === 'object' && 'length' in arg)) {
            let msg = '{#each} only iterates over array-like objects.';
            if (typeof Symbol === 'function' && arg && Symbol.iterator in arg) {
                msg += ' You can use a spread to convert this iterable into an array.';
            }
            throw new Error(msg);
        }
    }
    function validate_slots(name, slot, keys) {
        for (const slot_key of Object.keys(slot)) {
            if (!~keys.indexOf(slot_key)) {
                console.warn(`<${name}> received an unexpected slot "${slot_key}".`);
            }
        }
    }
    /**
     * Base class for Svelte components with some minor dev-enhancements. Used when dev=true.
     */
    class SvelteComponentDev extends SvelteComponent {
        constructor(options) {
            if (!options || (!options.target && !options.$$inline)) {
                throw new Error("'target' is a required option");
            }
            super();
        }
        $destroy() {
            super.$destroy();
            this.$destroy = () => {
                console.warn('Component was already destroyed'); // eslint-disable-line no-console
            };
        }
        $capture_state() { }
        $inject_state() { }
    }

    function regexparam (str, loose) {
    	if (str instanceof RegExp) return { keys:false, pattern:str };
    	var c, o, tmp, ext, keys=[], pattern='', arr = str.split('/');
    	arr[0] || arr.shift();

    	while (tmp = arr.shift()) {
    		c = tmp[0];
    		if (c === '*') {
    			keys.push('wild');
    			pattern += '/(.*)';
    		} else if (c === ':') {
    			o = tmp.indexOf('?', 1);
    			ext = tmp.indexOf('.', 1);
    			keys.push( tmp.substring(1, !!~o ? o : !!~ext ? ext : tmp.length) );
    			pattern += !!~o && !~ext ? '(?:/([^/]+?))?' : '/([^/]+?)';
    			if (!!~ext) pattern += (!!~o ? '?' : '') + '\\' + tmp.substring(ext);
    		} else {
    			pattern += '/' + tmp;
    		}
    	}

    	return {
    		keys: keys,
    		pattern: new RegExp('^' + pattern + (loose ? '(?=$|\/)' : '\/?$'), 'i')
    	};
    }

    const subscriber_queue = [];
    /**
     * Creates a `Readable` store that allows reading by subscription.
     * @param value initial value
     * @param {StartStopNotifier}start start and stop notifications for subscriptions
     */
    function readable(value, start) {
        return {
            subscribe: writable(value, start).subscribe
        };
    }
    /**
     * Create a `Writable` store that allows both updating and reading by subscription.
     * @param {*=}value initial value
     * @param {StartStopNotifier=}start start and stop notifications for subscriptions
     */
    function writable(value, start = noop) {
        let stop;
        const subscribers = [];
        function set(new_value) {
            if (safe_not_equal(value, new_value)) {
                value = new_value;
                if (stop) { // store is ready
                    const run_queue = !subscriber_queue.length;
                    for (let i = 0; i < subscribers.length; i += 1) {
                        const s = subscribers[i];
                        s[1]();
                        subscriber_queue.push(s, value);
                    }
                    if (run_queue) {
                        for (let i = 0; i < subscriber_queue.length; i += 2) {
                            subscriber_queue[i][0](subscriber_queue[i + 1]);
                        }
                        subscriber_queue.length = 0;
                    }
                }
            }
        }
        function update(fn) {
            set(fn(value));
        }
        function subscribe(run, invalidate = noop) {
            const subscriber = [run, invalidate];
            subscribers.push(subscriber);
            if (subscribers.length === 1) {
                stop = start(set) || noop;
            }
            run(value);
            return () => {
                const index = subscribers.indexOf(subscriber);
                if (index !== -1) {
                    subscribers.splice(index, 1);
                }
                if (subscribers.length === 0) {
                    stop();
                    stop = null;
                }
            };
        }
        return { set, update, subscribe };
    }
    function derived(stores, fn, initial_value) {
        const single = !Array.isArray(stores);
        const stores_array = single
            ? [stores]
            : stores;
        const auto = fn.length < 2;
        return readable(initial_value, (set) => {
            let inited = false;
            const values = [];
            let pending = 0;
            let cleanup = noop;
            const sync = () => {
                if (pending) {
                    return;
                }
                cleanup();
                const result = fn(single ? values[0] : values, set);
                if (auto) {
                    set(result);
                }
                else {
                    cleanup = is_function(result) ? result : noop;
                }
            };
            const unsubscribers = stores_array.map((store, i) => subscribe(store, (value) => {
                values[i] = value;
                pending &= ~(1 << i);
                if (inited) {
                    sync();
                }
            }, () => {
                pending |= (1 << i);
            }));
            inited = true;
            sync();
            return function stop() {
                run_all(unsubscribers);
                cleanup();
            };
        });
    }

    var LoadableEntryAction;
    (function (LoadableEntryAction) {
        LoadableEntryAction[LoadableEntryAction["NoOp"] = 0] = "NoOp";
        LoadableEntryAction[LoadableEntryAction["New"] = 1] = "New";
        LoadableEntryAction[LoadableEntryAction["Resume"] = 2] = "Resume";
    })(LoadableEntryAction || (LoadableEntryAction = {}));
    var UnloadableEntryAction;
    (function (UnloadableEntryAction) {
        UnloadableEntryAction[UnloadableEntryAction["NoOp"] = 0] = "NoOp";
        UnloadableEntryAction[UnloadableEntryAction["Destroy"] = 1] = "Destroy";
        UnloadableEntryAction[UnloadableEntryAction["Pause"] = 2] = "Pause";
    })(UnloadableEntryAction || (UnloadableEntryAction = {}));
    var NavigationType;
    (function (NavigationType) {
        NavigationType[NavigationType["GoForwardNewState"] = 0] = "GoForwardNewState";
        NavigationType[NavigationType["GoForwardResumeState"] = 1] = "GoForwardResumeState";
        NavigationType[NavigationType["GoBackward"] = 2] = "GoBackward";
        NavigationType[NavigationType["Replace"] = 3] = "Replace";
    })(NavigationType || (NavigationType = {}));

    function animationFrame() {
        return new Promise((res) => requestAnimationFrame(() => res()));
    }
    function sleep(ms) {
        return new Promise((res) => setTimeout(() => res(), ms));
    }
    function dispatchCustomEvent(element, eventName) {
        element.dispatchEvent(new CustomEvent(eventName, {
            bubbles: true,
            cancelable: true,
        }));
    }

    /* eslint-disable no-restricted-properties */
    function makeStyleTag(content) {
        const styleTag = document.createElement('style');
        styleTag.innerHTML = content;
        return styleTag;
    }
    function commonTransitionGenerator(duration, styleBeforeGenerator, styleDuringGenerator) {
        return async (transitionFunctionData) => {
            var _a, _b;
            const timestamp = new Date().getTime();
            const unloadClass = `unload-${timestamp}`;
            const loadClass = `load-${timestamp}`;
            const routerClass = `router-${timestamp}`;
            const styleBefore = styleBeforeGenerator(loadClass, unloadClass, routerClass, transitionFunctionData);
            const styleDuring = styleDuringGenerator(loadClass, unloadClass, routerClass, transitionFunctionData);
            (_a = transitionFunctionData.mountPointToUnload) === null || _a === void 0 ? void 0 : _a.classList.add(unloadClass);
            transitionFunctionData.mountPointToLoad.classList.add(loadClass);
            transitionFunctionData.routerMountPoint.classList.add(routerClass);
            document.head.appendChild(styleBefore);
            await animationFrame();
            await animationFrame();
            await animationFrame();
            document.head.appendChild(styleDuring);
            await sleep(duration);
            window.scrollTo(transitionFunctionData.scroll.x, transitionFunctionData.scroll.y);
            if (window.getComputedStyle(document.documentElement).scrollBehavior === 'smooth') {
                // At the moment of writing this comment there is no official/simple way to wait for the
                // window.scrollTo method to complete the animation
                // Hack: loop for a maximum of 500ms checking if the scroll position is close enough to the target transitionFunctionData.scroll
                const threshold = 5;
                for (let i = 0; i < 50; i++) {
                    if (Math.sqrt(Math.pow(window.scrollX - transitionFunctionData.scroll.x, 2)
                        + Math.pow(window.scrollY - transitionFunctionData.scroll.y, 2)) < threshold) {
                        break;
                    }
                    await sleep(10);
                }
            }
            document.head.removeChild(styleBefore);
            document.head.removeChild(styleDuring);
            (_b = transitionFunctionData.mountPointToUnload) === null || _b === void 0 ? void 0 : _b.classList.remove(unloadClass);
            transitionFunctionData.mountPointToLoad.classList.remove(loadClass);
            transitionFunctionData.routerMountPoint.classList.remove(routerClass);
        };
    }
    function slide(duration) {
        return commonTransitionGenerator(duration, (loadClass, unloadClass, routerClass, transitionFunctionData) => makeStyleTag(`
			html {
				scroll-behavior: smooth;
			}
			.${loadClass} {
				position: absolute;
				z-index: 2;
				left: 0;
				top: 0;
				right: 0;
				opacity: 0;
				transform: translateX(${transitionFunctionData.navigationType === NavigationType.GoBackward ? '-' : ''}50%);
			}
			.${unloadClass} {
				position: relative;
				z-index: 1;
				opacity: 1;
				transform: translateX(0%);
			}
			.${routerClass} {
				position: relative;
				min-height: ${transitionFunctionData.routerMountPoint.offsetHeight}px;
				min-width: ${transitionFunctionData.routerMountPoint.offsetWidth}px;
			}
		`), (loadClass, unloadClass, _, transitionFunctionData) => makeStyleTag(`
			.${loadClass} {
				transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear ${Math.floor(duration / 2)}ms;
				opacity: 1;
				transform: translateX(0%);
			}
			.${unloadClass} {
				transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear;
				opacity: 0;
				transform: translateX(${transitionFunctionData.navigationType === NavigationType.GoBackward ? '' : '-'}50%);
			}
		`));
    }
    function dive(duration) {
        return commonTransitionGenerator(duration, (loadClass, unloadClass, routerClass, transitionFunctionData) => makeStyleTag(`
			html {
				scroll-behavior: smooth;
			}
			.${loadClass} {
				position: absolute;
				z-index: 2;
				left: 0;
				top: 0;
				right: 0;
				opacity: 0;
				transform: translateZ(${transitionFunctionData.navigationType === NavigationType.GoBackward ? '' : '-'}150px);
			}
			.${unloadClass} {
				position: relative;
				z-index: 1;
				opacity: 1;
				transform: translateZ(0px);
			}
			.${routerClass} {
				perspective: 1200px;
				perspective-origin: top center;
				position: relative;
				min-height: ${transitionFunctionData.routerMountPoint.offsetHeight}px;
				min-width: ${transitionFunctionData.routerMountPoint.offsetWidth}px;
				background: 
			}
		`), (loadClass, unloadClass, _, transitionFunctionData) => makeStyleTag(`
			.${loadClass} {
				transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear ${Math.floor(duration / 2)}ms;
				opacity: 1;
				transform: translateZ(0px);
			}
			.${unloadClass} {
				transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear;
				opacity: 0;
				transform: translateZ(${transitionFunctionData.navigationType === NavigationType.GoBackward ? '-' : ''}150px);
			}
		`));
    }
    function noAnimation() {
        return ({ scroll }) => {
            window.scrollTo(scroll.x, scroll.y);
            return Promise.resolve();
        };
    }

    const config = {
        defaultResumable: true,
        useHash: true,
        restoreScroll: true,
        routes: {},
        mountPoint: null,
        transitionFn: noAnimation(),
        dispatch: null,
    };
    const internalCache = writable([]);
    /** Current component cache readable store */
    const cache = derived(internalCache, (x) => x);
    /* LOCATION */
    function getLocation() {
        if (config.useHash) {
            const hashIndex = window.location.href.indexOf('#/');
            const location = hashIndex > -1 ? window.location.href.substring(hashIndex + 1) : '/';
            return location;
        }
        const relativeUrl = (window.location.pathname || '/') + window.location.search;
        return relativeUrl;
    }
    // Used in the `pop` function to prevent a double trigger of the PopStateEvent
    let ignorePopStateEvent = false;
    /**
     * Readable store representing the current location
     */
    const location = readable(getLocation(), (set) => {
        let previousLocation = null;
        const handlePopState = async () => {
            if (ignorePopStateEvent) {
                return;
            }
            const newLocation = getLocation();
            if (previousLocation !== newLocation) {
                previousLocation = newLocation;
                set(newLocation);
            }
        };
        window.addEventListener('popstate', handlePopState);
        return function stop() {
            window.removeEventListener('popstate', handlePopState);
        };
    });
    /* PATHNAME */
    function getPathname(location) {
        const queryStringPosition = location.indexOf('?');
        if (queryStringPosition !== -1) {
            return location.substring(0, queryStringPosition);
        }
        return location;
    }
    /**
     * Readable store that contains the pathname part of the location
     */
    const pathname = derived(location, getPathname);
    /* SEARCH */
    function getSearch(location) {
        const queryStringPosition = location.indexOf('?');
        if (queryStringPosition !== -1) {
            return location.substring(queryStringPosition);
        }
        return '';
    }
    /**
     * Readable store that contains the search part of the location
     */
    const search = derived(location, getSearch);
    /* UTILS */
    let lastHistoryTimestamp;
    async function waitForHistoryState(callback) {
        const historyState = window.history.state;
        callback();
        // Wait for history.state to pick the current state (without this sleep history.state points to the previous state)
        // See https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event
        let limit = 100;
        while (historyState === window.history.state && limit) {
            await sleep(2);
            limit--;
        }
        if (historyState === window.history.state) {
            console.warn('unable to detect history change');
        }
    }
    function buildParams(pathname, routeKey) {
        const { pattern, keys } = regexparam(routeKey);
        const matches = pattern.exec(pathname) || [];
        const params = keys.reduce((params, _, index) => {
            params[keys[index]] = matches[index + 1] === undefined ? null : decodeURIComponent(matches[index + 1]);
            return params;
        }, {});
        return Object.keys(params).length === 0 ? undefined : params;
    }
    /* LOCATION UPDATE CONSUMER */
    const historyItemsQueue = [];
    let consumingQueue = false;
    async function consumeQueue() {
        if (consumingQueue) {
            return;
        }
        consumingQueue = true;
        while (historyItemsQueue.length > 0) {
            const item = historyItemsQueue.shift();
            await handleHistoryChange(item);
        }
        consumingQueue = false;
    }
    /* INIT & DESTROY */
    let locationSubscription = noop;
    function updateConfig(initConfig) {
        Object.keys(initConfig)
            .forEach((key) => {
            if (initConfig[key] !== undefined) {
                config[key] = initConfig[key];
            }
        });
        if ('scrollRestoration' in window.history) {
            window.history.scrollRestoration = config.restoreScroll ? 'manual' : 'auto';
        }
    }
    function handleStackRouterComponentMount(initConfig) {
        updateConfig(initConfig);
        locationSubscription = location
            .subscribe(async ($location) => {
            // Wait for history.state to pick the current state (without this sleep history.state can point to the previous state)
            // See https://developer.mozilla.org/en-US/docs/Web/API/Window/popstate_event
            let currentState = window.history.state;
            historyItemsQueue.push({
                location: $location,
                state: currentState,
            });
            consumeQueue();
        });
    }
    function handleStackRouterComponentDestroy() {
        locationSubscription();
        internalCache.set([]);
        locationSubscription = noop;
        config.mountPoint = null;
        config.dispatch = null;
    }
    let editableEntryConfig = null;
    async function prepareCacheEntryToActivate(cache, pathname) {
        const routeKeys = Object.keys(config.routes);
        const routeKey = routeKeys.find((routeKey) => {
            const { pattern } = regexparam(routeKey);
            return pattern.test(pathname);
        });
        if (routeKey === undefined || routeKey === null) {
            return null;
        }
        const params = buildParams(pathname, routeKey);
        const resumableEntry = cache.find((s) => s.routeMatch === routeKey);
        let entry;
        if (resumableEntry) {
            editableEntryConfig = resumableEntry.entryConfig;
            entry = resumableEntry;
            if (resumableEntry.pathname !== pathname) {
                resumableEntry.componentInstance.$set({ params });
                resumableEntry.pathname = pathname;
            }
        }
        else {
            const mountPoint = document.createElement('div');
            editableEntryConfig = {
                resumable: config.defaultResumable,
            };
            entry = {
                component: config.routes[routeKey],
                componentInstance: new config.routes[routeKey]({ target: mountPoint, props: { params } }),
                mountPoint,
                pathname,
                routeMatch: routeKey,
                entryConfig: editableEntryConfig,
            };
        }
        await tick();
        editableEntryConfig = null;
        return entry;
    }
    let activeCacheEntry = null;
    async function handleHistoryChange(historyItem) {
        var _a, _b, _c;
        const currentCache = get_store_value(internalCache);
        const isNewHistoryItem = !historyItem.state;
        if (isNewHistoryItem) {
            historyItem.state = {
                timestamp: new Date().getTime(),
            };
            await waitForHistoryState(() => window.history.replaceState(historyItem.state, '', (config.useHash ? '#' : '') + historyItem.location));
        }
        const pageToLoad = await prepareCacheEntryToActivate(currentCache, getPathname(historyItem.location));
        if (!pageToLoad) {
            (_a = config.dispatch) === null || _a === void 0 ? void 0 : _a.call(config, 'error', {
                message: 'no route found',
                location: historyItem.location,
            });
            return;
        }
        const pageToUnload = activeCacheEntry;
        const newTopIndexInCurrentStack = currentCache.findIndex((s) => s.routeMatch === pageToLoad.routeMatch);
        let pageToLoadAction = LoadableEntryAction.NoOp;
        let pageToUnloadAction = UnloadableEntryAction.NoOp;
        let navigationType = NavigationType.GoForwardNewState;
        if (!pageToUnload) {
            pageToLoadAction = LoadableEntryAction.New;
        }
        else {
            if (pageToUnload.routeMatch !== pageToLoad.routeMatch) {
                if (newTopIndexInCurrentStack !== -1) {
                    pageToLoadAction = LoadableEntryAction.Resume;
                }
                else {
                    pageToLoadAction = LoadableEntryAction.New;
                }
                if (pageToUnload.entryConfig.resumable) {
                    pageToUnloadAction = UnloadableEntryAction.Pause;
                }
                else {
                    pageToUnloadAction = UnloadableEntryAction.Destroy;
                }
            }
            if (isNewHistoryItem) {
                navigationType = NavigationType.GoForwardNewState;
            }
            else if (historyItem.state.timestamp > lastHistoryTimestamp) {
                navigationType = NavigationType.GoForwardResumeState;
            }
            else if (historyItem.state.timestamp < lastHistoryTimestamp) {
                navigationType = NavigationType.GoBackward;
            }
            else {
                navigationType = NavigationType.Replace;
            }
        }
        (_b = config.dispatch) === null || _b === void 0 ? void 0 : _b.call(config, 'navigation-start', {
            location: historyItem.location,
            navigationType,
            pageToLoad,
            pageToUnload,
            pageToLoadAction,
            pageToUnloadAction,
        });
        // BEFORE TRANSITION
        async function beforeUnload() {
            if (pageToUnload
                && pageToUnloadAction !== UnloadableEntryAction.NoOp
                && pageToUnload.entryConfig.onBeforeUnload
                && pageToUnload.entryConfig.onBeforeUnload.length > 0) {
                for (const callback of pageToUnload.entryConfig.onBeforeUnload) {
                    await callback();
                }
            }
        }
        async function beforeLoad() {
            if (pageToLoad
                && pageToLoadAction !== LoadableEntryAction.NoOp
                && pageToLoad.entryConfig.onBeforeLoad
                && pageToLoad.entryConfig.onBeforeLoad.length > 0) {
                for (const callback of pageToLoad.entryConfig.onBeforeLoad) {
                    await callback();
                }
            }
        }
        await Promise.all([beforeUnload(), beforeLoad()]);
        // DURING TRANSITION
        async function pause() {
            if (pageToUnload
                && pageToUnloadAction === UnloadableEntryAction.Pause
                && pageToUnload.entryConfig.onPause
                && pageToUnload.entryConfig.onPause.length > 0) {
                for (const callback of pageToUnload.entryConfig.onPause) {
                    await callback();
                }
            }
        }
        async function resume() {
            if (pageToLoad && pageToLoadAction === LoadableEntryAction.Resume) {
                const { returnValue } = historyItem.state || {};
                await waitForHistoryState(() => {
                    // Remove returnValue and scroll
                    window.history.replaceState({
                        timestamp: historyItem.state.timestamp,
                    }, '', (config.useHash ? '#' : '') + historyItem.location);
                });
                if (pageToLoad.entryConfig.onResume && pageToLoad.entryConfig.onResume.length > 0) {
                    for (const callback of pageToLoad.entryConfig.onResume) {
                        await callback(returnValue);
                    }
                }
            }
        }
        const oldTopMountPoint = pageToUnload ? pageToUnload.mountPoint : null;
        const newTopMountPoint = pageToLoad.mountPoint;
        if (oldTopMountPoint !== newTopMountPoint) {
            async function transition() {
                if (config.mountPoint) {
                    if (!newTopMountPoint.parentElement) {
                        config.mountPoint.appendChild(newTopMountPoint);
                    }
                    await config.transitionFn({
                        navigationType,
                        routerMountPoint: config.mountPoint,
                        mountPointToLoad: newTopMountPoint,
                        mountPointToUnload: oldTopMountPoint,
                        scroll: historyItem.state.scroll || { x: 0, y: 0 },
                    });
                    if (oldTopMountPoint) {
                        config.mountPoint.removeChild(oldTopMountPoint);
                    }
                }
            }
            await Promise.all([
                transition(),
                pause(),
                resume(),
            ]);
        }
        // AFTER TRANSITION
        async function afterLoad() {
            if (pageToLoad
                && pageToLoadAction !== LoadableEntryAction.NoOp
                && pageToLoad.entryConfig.onAfterLoad
                && pageToLoad.entryConfig.onAfterLoad.length > 0) {
                for (const callback of pageToLoad.entryConfig.onAfterLoad) {
                    await callback();
                }
            }
        }
        async function afterUnload() {
            if (pageToUnload
                && pageToUnloadAction !== UnloadableEntryAction.NoOp
                && pageToUnload.entryConfig.onAfterUnload
                && pageToUnload.entryConfig.onAfterUnload.length > 0) {
                for (const callback of pageToUnload.entryConfig.onAfterUnload) {
                    await callback();
                }
            }
        }
        await Promise.all([afterLoad(), afterUnload()]);
        if (pageToLoadAction === LoadableEntryAction.New) {
            currentCache.push(pageToLoad);
        }
        if (pageToUnload && pageToUnloadAction === UnloadableEntryAction.Destroy) {
            pageToUnload.componentInstance.$destroy();
            currentCache.splice(currentCache.indexOf(pageToUnload), 1);
        }
        internalCache.set(currentCache);
        activeCacheEntry = pageToLoad;
        lastHistoryTimestamp = historyItem.state.timestamp;
        (_c = config.dispatch) === null || _c === void 0 ? void 0 : _c.call(config, 'navigation-end', {
            location: historyItem.location,
            navigationType,
            pageToLoad,
            pageToUnload,
            pageToLoadAction,
            pageToUnloadAction,
        });
    }
    /* API FUNCTIONS */
    /**
     * Replaces the current history location and state
     * @param location new location
     * @param state new history state
     */
    async function replace(location, state) {
        await waitForHistoryState(() => {
            window.history.replaceState({
                ...(state || {}),
                timestamp: lastHistoryTimestamp,
            }, '', (config.useHash ? '#' : '') + location);
        });
        dispatchCustomEvent(window, 'popstate');
    }
    /**
     * Navigates to a new location
     * If scroll restoration is enabled, the current window scroll position is persisted before leaving the current location
     * If the new location equals the current one, this function won't modify the browser history
     * @param location new location
     */
    async function push(location) {
        if (location === getLocation()) {
            return;
        }
        if (config.restoreScroll) {
            await waitForHistoryState(() => {
                window.history.replaceState({
                    timestamp: window.history.state ? window.history.state.timestamp : new Date().getTime(),
                    scroll: {
                        x: window.scrollY,
                        y: window.scrollY,
                    },
                }, '', (config.useHash ? '#' : '') + getLocation());
            });
        }
        await waitForHistoryState(() => {
            window.history.pushState(undefined, '', (config.useHash ? '#' : '') + location);
        });
        dispatchCustomEvent(window, 'popstate');
    }
    /**
     * Navigates back
     * @param returnValue a serializable object that will be returned to the component associated with the previous location if resumable
     */
    async function pop(returnValue) {
        ignorePopStateEvent = true;
        await waitForHistoryState(() => window.history.back());
        await waitForHistoryState(() => {
            window.history.replaceState({
                ...window.history.state || {},
                returnValue,
            }, '', (config.useHash ? '#' : '') + getLocation());
        });
        ignorePopStateEvent = false;
        dispatchCustomEvent(window, 'popstate');
    }
    /**
     * Svelte action that can be associated with an HTMLAnchorElement (`<a>`) to automatically prefix '#' when using client side navigation only
     * @param node the HTML anchor tag
     * @param href the href attribute of the anchor tag
     * @returns an object containing the callback Svelte will use to trigger updates
     */
    function link(node, href) {
        if (!node || !node.tagName || node.tagName.toLowerCase() !== 'a') {
            throw new Error('not a <a> tag');
        }
        async function pushState(e) {
            if (!e.ctrlKey) {
                e.preventDefault();
                // for an unknown reason, pushing the state blocks any on:click handler attached in a Svelte file.
                // This sleep lets the event propagate and schedules the push call after the bubbling has finished
                await sleep(1);
                push(config.useHash ? node.getAttribute('href').substring(1) : node.getAttribute('href'));
            }
        }
        node.addEventListener('click', pushState);
        function hashHref(node, href) {
            if (!href || href.length < 1 || href.charAt(0) !== '/') {
                throw new Error(`invalid href ${href}`);
            }
            node.setAttribute('href', `${config.useHash ? '#' : ''}${href}`);
        }
        hashHref(node, href || node.getAttribute('href'));
        return {
            update(href) {
                hashHref(node, href);
            },
        };
    }
    /* COMPONENT LIFECYCLE */
    const lifecycleErrorText = 'lifecycle functions can only be'
        + ' called while initializing or before preparing a component to resume (i.e. with a reactive statement on "params")';
    /**
     * Attaches a callback to the resume lifecycle phase.
     * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
     * - create the page component if not in cache
     * - before-unload previous component || before-load new component
     * - pause previous component if resumable || resume new component if in cache || animate-transition
     * - after-unload previous component || after-load new component
     * - destroy previous component if not resumable
     * @param callback function that will be called when the component is resumed
     */
    function onResume(callback) {
        if (!editableEntryConfig) {
            throw new Error(lifecycleErrorText);
        }
        if (!editableEntryConfig.onResume) {
            editableEntryConfig.onResume = [];
        }
        editableEntryConfig.onResume.push(callback);
    }
    /**
     * Attaches a callback to the pause lifecycle phase.
     * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
     * - create the page component if not in cache
     * - before-unload previous component || before-load new component
     * - pause previous component if resumable || resume new component if in cache || animate-transition
     * - after-unload previous component || after-load new component
     * - destroy previous component if not resumable
     * @param callback function that will be called when the component is paused
     */
    function onPause(callback) {
        if (!editableEntryConfig) {
            throw new Error(lifecycleErrorText);
        }
        if (!editableEntryConfig.onPause) {
            editableEntryConfig.onPause = [];
        }
        editableEntryConfig.onPause.push(callback);
    }
    /**
     * Attaches a callback to the before-unload lifecycle phase.
     * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
     * - create the page component if not in cache
     * - before-unload previous component || before-load new component
     * - pause previous component if resumable || resume new component if in cache || animate-transition
     * - after-unload previous component || after-load new component
     * - destroy previous component if not resumable
     * @param callback function that will be called when the component is being prepared for unloading
     */
    function onBeforeUnload(callback) {
        if (!editableEntryConfig) {
            throw new Error(lifecycleErrorText);
        }
        if (!editableEntryConfig.onBeforeUnload) {
            editableEntryConfig.onBeforeUnload = [];
        }
        editableEntryConfig.onBeforeUnload.push(callback);
    }
    /**
     * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
     * - create the page component if not in cache
     * - before-unload previous component || before-load new component
     * - pause previous component if resumable || resume new component if in cache || animate-transition
     * - after-unload previous component || after-load new component
     * - destroy previous component if not resumable
     * @param callback function that will be called when the component has finished loading
     */
    function onAfterLoad(callback) {
        if (!editableEntryConfig) {
            throw new Error(lifecycleErrorText);
        }
        if (!editableEntryConfig.onAfterLoad) {
            editableEntryConfig.onAfterLoad = [];
        }
        editableEntryConfig.onAfterLoad.push(callback);
    }
    /**
     * Attaches a callback to the after-unload lifecycle phase.
     * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
     * - create the page component if not in cache
     * - before-unload previous component || before-load new component
     * - pause previous component if resumable || resume new component if in cache || animate-transition
     * - after-unload previous component || after-load new component
     * - destroy previous component if not resumable
     * @param callback function that will be called when the component has finished unloading
     */
    function onAfterUnload(callback) {
        if (!editableEntryConfig) {
            throw new Error(lifecycleErrorText);
        }
        if (!editableEntryConfig.onAfterUnload) {
            editableEntryConfig.onAfterUnload = [];
        }
        editableEntryConfig.onAfterUnload.push(callback);
    }
    /**
     * Attaches a callback to the before-load lifecycle phase.
     * Lifecycle summary (|| = semi-parallel execution, achieved with Promise.all):
     * - create the page component if not in cache
     * - before-unload previous component || before-load new component
     * - pause previous component if resumable || resume new component if in cache || animate-transition
     * - after-unload previous component || after-load new component
     * - destroy previous component if not resumable
     * @param callback function that will be called when the component is being prepared for loading
     */
    function onBeforeLoad(callback) {
        if (!editableEntryConfig) {
            throw new Error(lifecycleErrorText);
        }
        if (!editableEntryConfig.onBeforeLoad) {
            editableEntryConfig.onBeforeLoad = [];
        }
        editableEntryConfig.onBeforeLoad.push(callback);
    }
    /**
     * Determines whether the component will be paused or destroyed
     * @param resumable whether the component should be paused and resumed or completely destroyed and recreated
     */
    function setResumable(resumable) {
        if (!editableEntryConfig) {
            throw new Error(lifecycleErrorText);
        }
        editableEntryConfig.resumable = resumable;
    }

    /* src/StackRouter.svelte generated by Svelte v3.38.2 */
    const file = "src/StackRouter.svelte";

    function create_fragment(ctx) {
    	let div;

    	const block = {
    		c: function create() {
    			div = element("div");
    			attr_dev(div, "class", "stack-router-mount-point");
    			add_location(div, file, 52, 0, 1535);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			/*div_binding*/ ctx[6](div);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			/*div_binding*/ ctx[6](null);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("StackRouter", slots, []);
    	let { defaultResumable = true } = $$props;
    	let { useHash = true } = $$props;
    	let { restoreScroll = true } = $$props;
    	let { transitionFn = dive(300) } = $$props;
    	let { routes } = $$props;
    	let dispatch = createEventDispatcher();
    	let mountPoint;

    	onMount(() => {
    		handleStackRouterComponentMount({
    			mountPoint,
    			routes,
    			defaultResumable,
    			useHash,
    			restoreScroll,
    			transitionFn,
    			dispatch
    		});
    	});

    	onDestroy(() => {
    		handleStackRouterComponentDestroy();
    	});

    	const writable_props = ["defaultResumable", "useHash", "restoreScroll", "transitionFn", "routes"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<StackRouter> was created with unknown prop '${key}'`);
    	});

    	function div_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			mountPoint = $$value;
    			$$invalidate(0, mountPoint);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("defaultResumable" in $$props) $$invalidate(1, defaultResumable = $$props.defaultResumable);
    		if ("useHash" in $$props) $$invalidate(2, useHash = $$props.useHash);
    		if ("restoreScroll" in $$props) $$invalidate(3, restoreScroll = $$props.restoreScroll);
    		if ("transitionFn" in $$props) $$invalidate(4, transitionFn = $$props.transitionFn);
    		if ("routes" in $$props) $$invalidate(5, routes = $$props.routes);
    	};

    	$$self.$capture_state = () => ({
    		createEventDispatcher,
    		onDestroy,
    		onMount,
    		handleStackRouterComponentMount,
    		handleStackRouterComponentDestroy,
    		updateConfig,
    		dive,
    		defaultResumable,
    		useHash,
    		restoreScroll,
    		transitionFn,
    		routes,
    		dispatch,
    		mountPoint
    	});

    	$$self.$inject_state = $$props => {
    		if ("defaultResumable" in $$props) $$invalidate(1, defaultResumable = $$props.defaultResumable);
    		if ("useHash" in $$props) $$invalidate(2, useHash = $$props.useHash);
    		if ("restoreScroll" in $$props) $$invalidate(3, restoreScroll = $$props.restoreScroll);
    		if ("transitionFn" in $$props) $$invalidate(4, transitionFn = $$props.transitionFn);
    		if ("routes" in $$props) $$invalidate(5, routes = $$props.routes);
    		if ("dispatch" in $$props) dispatch = $$props.dispatch;
    		if ("mountPoint" in $$props) $$invalidate(0, mountPoint = $$props.mountPoint);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*defaultResumable, useHash, restoreScroll, transitionFn, routes*/ 62) {
    			 (updateConfig({
    				routes,
    				defaultResumable,
    				useHash,
    				restoreScroll,
    				transitionFn
    			}));
    		}
    	};

    	return [
    		mountPoint,
    		defaultResumable,
    		useHash,
    		restoreScroll,
    		transitionFn,
    		routes,
    		div_binding
    	];
    }

    class StackRouter extends SvelteComponentDev {
    	constructor(options) {
    		super(options);

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			defaultResumable: 1,
    			useHash: 2,
    			restoreScroll: 3,
    			transitionFn: 4,
    			routes: 5
    		});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "StackRouter",
    			options,
    			id: create_fragment.name
    		});

    		const { ctx } = this.$$;
    		const props = options.props || {};

    		if (/*routes*/ ctx[5] === undefined && !("routes" in props)) {
    			console.warn("<StackRouter> was created without expected prop 'routes'");
    		}
    	}

    	get defaultResumable() {
    		throw new Error("<StackRouter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set defaultResumable(value) {
    		throw new Error("<StackRouter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get useHash() {
    		throw new Error("<StackRouter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set useHash(value) {
    		throw new Error("<StackRouter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get restoreScroll() {
    		throw new Error("<StackRouter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set restoreScroll(value) {
    		throw new Error("<StackRouter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get transitionFn() {
    		throw new Error("<StackRouter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set transitionFn(value) {
    		throw new Error("<StackRouter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	get routes() {
    		throw new Error("<StackRouter>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set routes(value) {
    		throw new Error("<StackRouter>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/pages/Home.svelte generated by Svelte v3.38.2 */

    const file$1 = "src/pages/Home.svelte";

    function create_fragment$1(ctx) {
    	let div0;
    	let h1;
    	let t1;
    	let div1;
    	let h2;
    	let t3;
    	let div2;
    	let p;

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "Welcome to svelte-stack-router";
    			t1 = space();
    			div1 = element("div");
    			h2 = element("h2");
    			h2.textContent = "A fast, app-like router that caches components";
    			t3 = space();
    			div2 = element("div");
    			p = element("p");
    			p.textContent = "Less re-renders, full state preservation and cool animations!";
    			add_location(h1, file$1, 1, 1, 34);
    			set_style(div0, "text-align", "center");
    			add_location(div0, file$1, 0, 0, 0);
    			add_location(h2, file$1, 4, 1, 115);
    			set_style(div1, "text-align", "center");
    			add_location(div1, file$1, 3, 0, 81);
    			add_location(p, file$1, 7, 1, 212);
    			set_style(div2, "text-align", "center");
    			add_location(div2, file$1, 6, 0, 178);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h1);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, h2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, p);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$1.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$1($$self, $$props) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Home", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Home> was created with unknown prop '${key}'`);
    	});

    	return [];
    }

    class Home extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$1, create_fragment$1, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Home",
    			options,
    			id: create_fragment$1.name
    		});
    	}
    }

    function cubicOut(t) {
        const f = t - 1.0;
        return f * f * f + 1.0;
    }

    function fly(node, { delay = 0, duration = 400, easing = cubicOut, x = 0, y = 0, opacity = 0 } = {}) {
        const style = getComputedStyle(node);
        const target_opacity = +style.opacity;
        const transform = style.transform === 'none' ? '' : style.transform;
        const od = target_opacity * (1 - opacity);
        return {
            delay,
            duration,
            easing,
            css: (t, u) => `
			transform: ${transform} translate(${(1 - t) * x}px, ${(1 - t) * y}px);
			opacity: ${target_opacity - (od * u)}`
        };
    }

    /* src/pages/Resumable.svelte generated by Svelte v3.38.2 */

    const file$2 = "src/pages/Resumable.svelte";

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[8] = list[i];
    	return child_ctx;
    }

    // (93:1) {#if params.aVariable}
    function create_if_block(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*params*/ ctx[0].aVariable + "";
    	let t1;
    	let t2;
    	let p_resize_listener;
    	let p_transition;
    	let current;

    	const block = {
    		c: function create() {
    			p = element("p");
    			t0 = text("I have a param! \"");
    			t1 = text(t1_value);
    			t2 = text("\"");
    			set_style(p, "margin", "0");
    			set_style(p, "display", "inline-block");
    			set_style(p, "padding", "10px");
    			set_style(p, "border-radius", "100px");
    			set_style(p, "background-color", "black");
    			add_render_callback(() => /*p_elementresize_handler*/ ctx[5].call(p));
    			add_location(p, file$2, 93, 2, 1873);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, p, anchor);
    			append_dev(p, t0);
    			append_dev(p, t1);
    			append_dev(p, t2);
    			p_resize_listener = add_resize_listener(p, /*p_elementresize_handler*/ ctx[5].bind(p));
    			current = true;
    		},
    		p: function update(ctx, dirty) {
    			if ((!current || dirty & /*params*/ 1) && t1_value !== (t1_value = /*params*/ ctx[0].aVariable + "")) set_data_dev(t1, t1_value);
    		},
    		i: function intro(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: -10, duration: 200 }, true);
    				p_transition.run(1);
    			});

    			current = true;
    		},
    		o: function outro(local) {
    			if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: -10, duration: 200 }, false);
    			p_transition.run(0);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(p);
    			p_resize_listener();
    			if (detaching && p_transition) p_transition.end();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block.name,
    		type: "if",
    		source: "(93:1) {#if params.aVariable}",
    		ctx
    	});

    	return block;
    }

    // (106:2) {#each events as event}
    function create_each_block(ctx) {
    	let li;
    	let t0_value = /*event*/ ctx[8] + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = space();
    			add_location(li, file$2, 106, 3, 2253);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t0);
    			append_dev(li, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*events*/ 2 && t0_value !== (t0_value = /*event*/ ctx[8] + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block.name,
    		type: "each",
    		source: "(106:2) {#each events as event}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$2(ctx) {
    	let div0;
    	let h1;
    	let t1;
    	let div1;
    	let label;
    	let input;
    	let t2;
    	let t3;
    	let div2;
    	let t4;
    	let div3;
    	let t6;
    	let div4;
    	let ul;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*params*/ ctx[0].aVariable && create_if_block(ctx);
    	let each_value = /*events*/ ctx[1];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "I'm a resumable component";
    			t1 = space();
    			div1 = element("div");
    			label = element("label");
    			input = element("input");
    			t2 = text("\n\t\tReturn a promise when unloading");
    			t3 = space();
    			div2 = element("div");
    			if (if_block) if_block.c();
    			t4 = space();
    			div3 = element("div");
    			div3.textContent = "Events so far:";
    			t6 = space();
    			div4 = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h1, file$2, 73, 1, 1385);
    			set_style(div0, "text-align", "center");
    			add_location(div0, file$2, 72, 0, 1351);
    			attr_dev(input, "type", "checkbox");
    			input.checked = /*wait1s*/ ctx[2];
    			add_location(input, file$2, 79, 2, 1588);
    			set_style(label, "background-color", "black");
    			set_style(label, "padding", "10px");
    			set_style(label, "display", "inline-block");
    			set_style(label, "border-radius", "100px");
    			add_location(label, file$2, 76, 1, 1482);
    			set_style(div1, "text-align", "center");
    			set_style(div1, "margin-bottom", "10px");
    			add_location(div1, file$2, 75, 0, 1427);
    			set_style(div2, "transition", "height 200ms ease");

    			set_style(div2, "height", (/*params*/ ctx[0].aVariable
    			? /*pOffsetHeight*/ ctx[3]
    			: 0) + "px");

    			add_location(div2, file$2, 87, 0, 1747);
    			set_style(div3, "padding-top", "10px");
    			add_location(div3, file$2, 102, 0, 2130);
    			set_style(ul, "display", "inline-block");
    			add_location(ul, file$2, 104, 1, 2189);
    			add_location(div4, file$2, 103, 0, 2182);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h1);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			append_dev(div1, label);
    			append_dev(label, input);
    			append_dev(label, t2);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);
    			if (if_block) if_block.m(div2, null);
    			insert_dev(target, t4, anchor);
    			insert_dev(target, div3, anchor);
    			insert_dev(target, t6, anchor);
    			insert_dev(target, div4, anchor);
    			append_dev(div4, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(input, "change", /*change_handler*/ ctx[4], false, false, false);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*wait1s*/ 4) {
    				prop_dev(input, "checked", /*wait1s*/ ctx[2]);
    			}

    			if (/*params*/ ctx[0].aVariable) {
    				if (if_block) {
    					if_block.p(ctx, dirty);

    					if (dirty & /*params*/ 1) {
    						transition_in(if_block, 1);
    					}
    				} else {
    					if_block = create_if_block(ctx);
    					if_block.c();
    					transition_in(if_block, 1);
    					if_block.m(div2, null);
    				}
    			} else if (if_block) {
    				group_outros();

    				transition_out(if_block, 1, 1, () => {
    					if_block = null;
    				});

    				check_outros();
    			}

    			if (!current || dirty & /*params, pOffsetHeight*/ 9) {
    				set_style(div2, "height", (/*params*/ ctx[0].aVariable
    				? /*pOffsetHeight*/ ctx[3]
    				: 0) + "px");
    			}

    			if (dirty & /*events*/ 2) {
    				each_value = /*events*/ ctx[1];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    			if (if_block) if_block.d();
    			if (detaching) detach_dev(t4);
    			if (detaching) detach_dev(div3);
    			if (detaching) detach_dev(t6);
    			if (detaching) detach_dev(div4);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$2.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$2($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Resumable", slots, []);
    	let { params = { aVariable: null } } = $$props;
    	let events = [];
    	let wait1s = true;

    	// Example of a resumable component lifecycle
    	onMount(() => {
    		$$invalidate(1, events = [...events, "onMount"]);
    	});

    	onBeforeLoad(() => {
    		$$invalidate(1, events = [...events, "onBeforeLoad"]);
    	});

    	onResume(retVal => {
    		$$invalidate(1, events = [...events, "onResume" + (retVal ? `, received: "${retVal}"` : "")]);
    	});

    	onAfterLoad(() => {
    		$$invalidate(1, events = [...events, "onAfterLoad"]);
    	});

    	onBeforeUnload(() => {
    		if (!wait1s) {
    			$$invalidate(1, events = [...events, "onBeforeUnload"]);
    			return;
    		}

    		$$invalidate(1, events = [
    			...events,
    			"onBeforeUnload, i'll just wait 1s before letting the router unload me"
    		]);

    		return new Promise(res => setTimeout(res, 1000));
    	});

    	onPause(() => {
    		$$invalidate(1, events = [...events, "onPause"]);
    	});

    	onAfterUnload(() => {
    		$$invalidate(1, events = [...events, "onAfterUnload"]);
    	});

    	onDestroy(() => {
    		// This won't get called
    		$$invalidate(1, events = [...events, "onDestroy"]);
    	});

    	let firstRun = true;

    	function onParamsChange() {
    		if (firstRun) {
    			firstRun = false;
    			return;
    		}

    		$$invalidate(1, events = [...events, "onParamsChange"]);
    	}

    	let pOffsetHeight;
    	const writable_props = ["params"];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Resumable> was created with unknown prop '${key}'`);
    	});

    	const change_handler = ({ target }) => $$invalidate(2, wait1s = target.checked);

    	function p_elementresize_handler() {
    		pOffsetHeight = this.offsetHeight;
    		$$invalidate(3, pOffsetHeight);
    	}

    	$$self.$$set = $$props => {
    		if ("params" in $$props) $$invalidate(0, params = $$props.params);
    	};

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		fly,
    		onBeforeUnload,
    		onPause,
    		onResume,
    		onAfterLoad,
    		onAfterUnload,
    		onBeforeLoad,
    		params,
    		events,
    		wait1s,
    		firstRun,
    		onParamsChange,
    		pOffsetHeight
    	});

    	$$self.$inject_state = $$props => {
    		if ("params" in $$props) $$invalidate(0, params = $$props.params);
    		if ("events" in $$props) $$invalidate(1, events = $$props.events);
    		if ("wait1s" in $$props) $$invalidate(2, wait1s = $$props.wait1s);
    		if ("firstRun" in $$props) firstRun = $$props.firstRun;
    		if ("pOffsetHeight" in $$props) $$invalidate(3, pOffsetHeight = $$props.pOffsetHeight);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*params*/ 1) {
    			 (onParamsChange());
    		}
    	};

    	return [params, events, wait1s, pOffsetHeight, change_handler, p_elementresize_handler];
    }

    class Resumable extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$2, create_fragment$2, safe_not_equal, { params: 0 });

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Resumable",
    			options,
    			id: create_fragment$2.name
    		});
    	}

    	get params() {
    		throw new Error("<Resumable>: Props cannot be read directly from the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}

    	set params(value) {
    		throw new Error("<Resumable>: Props cannot be set directly on the component instance unless compiling with 'accessors: true' or '<svelte:options accessors/>'");
    	}
    }

    /* src/pages/Throwaway.svelte generated by Svelte v3.38.2 */

    const file$3 = "src/pages/Throwaway.svelte";

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (55:2) {#each events as event}
    function create_each_block$1(ctx) {
    	let li;
    	let t0_value = /*event*/ ctx[1] + "";
    	let t0;
    	let t1;

    	const block = {
    		c: function create() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = space();
    			add_location(li, file$3, 55, 3, 1113);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, li, anchor);
    			append_dev(li, t0);
    			append_dev(li, t1);
    		},
    		p: function update(ctx, dirty) {
    			if (dirty & /*events*/ 1 && t0_value !== (t0_value = /*event*/ ctx[1] + "")) set_data_dev(t0, t0_value);
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(li);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$1.name,
    		type: "each",
    		source: "(55:2) {#each events as event}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$3(ctx) {
    	let div0;
    	let h1;
    	let t1;
    	let div1;
    	let t3;
    	let div2;
    	let ul;
    	let each_value = /*events*/ ctx[0];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	const block = {
    		c: function create() {
    			div0 = element("div");
    			h1 = element("h1");
    			h1.textContent = "I'm a non-resumable component";
    			t1 = space();
    			div1 = element("div");
    			div1.textContent = "Events so far:";
    			t3 = space();
    			div2 = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			add_location(h1, file$3, 49, 1, 970);
    			set_style(div0, "text-align", "center");
    			add_location(div0, file$3, 48, 0, 936);
    			add_location(div1, file$3, 51, 0, 1016);
    			set_style(ul, "display", "inline-block");
    			add_location(ul, file$3, 53, 1, 1049);
    			add_location(div2, file$3, 52, 0, 1042);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div0, anchor);
    			append_dev(div0, h1);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, div1, anchor);
    			insert_dev(target, t3, anchor);
    			insert_dev(target, div2, anchor);
    			append_dev(div2, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (dirty & /*events*/ 1) {
    				each_value = /*events*/ ctx[0];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$1(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$1(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(ul, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div0);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(div1);
    			if (detaching) detach_dev(t3);
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$3.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$3($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Throwaway", slots, []);
    	let events = [];
    	setResumable(false);

    	// Example of a non-resumable component lifecycle
    	onMount(() => {
    		$$invalidate(0, events = [...events, "onMount"]);
    	});

    	onBeforeLoad(() => {
    		$$invalidate(0, events = [...events, "onBeforeLoad"]);
    	});

    	onResume(retVal => {
    		// This won't get called
    		$$invalidate(0, events = [...events, "onResume" + (retVal ? `, received: "${retVal}"` : "")]); // will not be executed
    	});

    	onAfterLoad(() => {
    		$$invalidate(0, events = [...events, "onAfterLoad"]);
    	});

    	onBeforeUnload(() => {
    		$$invalidate(0, events = [...events, "onBeforeUnload"]);
    	});

    	onPause(() => {
    		// This won't get called
    		$$invalidate(0, events = [...events, "onPause"]);
    	});

    	onAfterUnload(() => {
    		$$invalidate(0, events = [...events, "onAfterUnload"]);
    	});

    	onDestroy(() => {
    		$$invalidate(0, events = [...events, "onDestroy"]);
    	});

    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Throwaway> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({
    		onMount,
    		onDestroy,
    		onBeforeUnload,
    		onPause,
    		onResume,
    		onAfterLoad,
    		onAfterUnload,
    		onBeforeLoad,
    		setResumable,
    		events
    	});

    	$$self.$inject_state = $$props => {
    		if ("events" in $$props) $$invalidate(0, events = $$props.events);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	return [events];
    }

    class Throwaway extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$3, create_fragment$3, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Throwaway",
    			options,
    			id: create_fragment$3.name
    		});
    	}
    }

    /* src/pages/Redirect.svelte generated by Svelte v3.38.2 */

    function create_fragment$4(ctx) {
    	let t;

    	const block = {
    		c: function create() {
    			t = text("I'm temporary... just wait a sec...");
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, t, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(t);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$4.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Redirect", slots, []);
    	replace("/");
    	setResumable(false);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Redirect> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ replace, setResumable });
    	return [];
    }

    class Redirect extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$4, create_fragment$4, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Redirect",
    			options,
    			id: create_fragment$4.name
    		});
    	}
    }

    /* src/pages/NotFound.svelte generated by Svelte v3.38.2 */
    const file$4 = "src/pages/NotFound.svelte";

    function create_fragment$5(ctx) {
    	let div;
    	let h1;
    	let t1;
    	let a;
    	let link_action;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			div = element("div");
    			h1 = element("h1");
    			h1.textContent = "Not found";
    			t1 = space();
    			a = element("a");
    			a.textContent = "Redirect";
    			add_location(h1, file$4, 6, 1, 85);
    			set_style(div, "text-align", "center");
    			add_location(div, file$4, 5, 0, 51);
    			attr_dev(a, "href", "/redirect");
    			add_location(a, file$4, 8, 0, 111);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, h1);
    			insert_dev(target, t1, anchor);
    			insert_dev(target, a, anchor);

    			if (!mounted) {
    				dispose = action_destroyer(link_action = link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (detaching) detach_dev(t1);
    			if (detaching) detach_dev(a);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$5.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("NotFound", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<NotFound> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ link });
    	return [];
    }

    class NotFound extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$5, create_fragment$5, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "NotFound",
    			options,
    			id: create_fragment$5.name
    		});
    	}
    }

    var routes = {
    	'/': Home,
    	'/resumable/:aVariable?': Resumable,
    	'/throwaway': Throwaway,
    	'/redirect': Redirect,
    	'*': NotFound,
    };

    /* src/components/Links.svelte generated by Svelte v3.38.2 */
    const file$5 = "src/components/Links.svelte";

    // (13:1) {#if historyLength > 2}
    function create_if_block$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	const block = {
    		c: function create() {
    			button = element("button");
    			button.textContent = "Go back passing a returnValue";
    			add_location(button, file$5, 13, 2, 458);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, button, anchor);

    			if (!mounted) {
    				dispose = listen_dev(button, "click", /*click_handler*/ ctx[2], false, false, false);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(button);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_if_block$1.name,
    		type: "if",
    		source: "(13:1) {#if historyLength > 2}",
    		ctx
    	});

    	return block;
    }

    function create_fragment$6(ctx) {
    	let div;
    	let a0;
    	let link_action;
    	let t1;
    	let a1;
    	let link_action_1;
    	let t3;
    	let a2;
    	let link_action_2;
    	let t5;
    	let a3;
    	let link_action_3;
    	let t7;
    	let mounted;
    	let dispose;
    	let if_block = /*historyLength*/ ctx[0] > 2 && create_if_block$1(ctx);

    	const block = {
    		c: function create() {
    			div = element("div");
    			a0 = element("a");
    			a0.textContent = "Home";
    			t1 = space();
    			a1 = element("a");
    			a1.textContent = "Go to Resumable";
    			t3 = space();
    			a2 = element("a");
    			a2.textContent = "Go to Resumable with parameter";
    			t5 = space();
    			a3 = element("a");
    			a3.textContent = "Go to Throwaway";
    			t7 = space();
    			if (if_block) if_block.c();
    			attr_dev(a0, "href", "/");
    			add_location(a0, file$5, 8, 1, 220);
    			attr_dev(a1, "href", "/resumable");
    			add_location(a1, file$5, 9, 1, 251);
    			attr_dev(a2, "href", "/resumable/here you go!");
    			add_location(a2, file$5, 10, 1, 302);
    			attr_dev(a3, "href", "/throwaway");
    			add_location(a3, file$5, 11, 1, 381);
    			set_style(div, "text-align", "center");
    			set_style(div, "margin-bottom", "20px");
    			add_location(div, file$5, 7, 0, 164);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div, anchor);
    			append_dev(div, a0);
    			append_dev(div, t1);
    			append_dev(div, a1);
    			append_dev(div, t3);
    			append_dev(div, a2);
    			append_dev(div, t5);
    			append_dev(div, a3);
    			append_dev(div, t7);
    			if (if_block) if_block.m(div, null);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(link_action = link.call(null, a0)),
    					action_destroyer(link_action_1 = link.call(null, a1)),
    					action_destroyer(link_action_2 = link.call(null, a2)),
    					action_destroyer(link_action_3 = link.call(null, a3))
    				];

    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (/*historyLength*/ ctx[0] > 2) {
    				if (if_block) {
    					if_block.p(ctx, dirty);
    				} else {
    					if_block = create_if_block$1(ctx);
    					if_block.c();
    					if_block.m(div, null);
    				}
    			} else if (if_block) {
    				if_block.d(1);
    				if_block = null;
    			}
    		},
    		i: noop,
    		o: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$6.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$6($$self, $$props, $$invalidate) {
    	let $location;
    	validate_store(location, "location");
    	component_subscribe($$self, location, $$value => $$invalidate(1, $location = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Links", slots, []);
    	let historyLength = window.history.length;
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<Links> was created with unknown prop '${key}'`);
    	});

    	const click_handler = () => pop("bye!");

    	$$self.$capture_state = () => ({
    		pop,
    		link,
    		location,
    		historyLength,
    		$location
    	});

    	$$self.$inject_state = $$props => {
    		if ("historyLength" in $$props) $$invalidate(0, historyLength = $$props.historyLength);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$location*/ 2) {
    			 ($$invalidate(0, historyLength = window.history.length));
    		}
    	};

    	return [historyLength, $location, click_handler];
    }

    class Links extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$6, create_fragment$6, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Links",
    			options,
    			id: create_fragment$6.name
    		});
    	}
    }

    /* src/pages/_Layout.svelte generated by Svelte v3.38.2 */

    const { console: console_1 } = globals;
    const file$6 = "src/pages/_Layout.svelte";

    function get_each_context$2(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[5] = list[i].label;
    	child_ctx[7] = i;
    	return child_ctx;
    }

    // (32:4) {#each transitions as { label }
    function create_each_block$2(ctx) {
    	let option;
    	let t_value = /*label*/ ctx[5] + "";
    	let t;
    	let option_value_value;

    	const block = {
    		c: function create() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*i*/ ctx[7];
    			option.value = option.__value;
    			add_location(option, file$6, 32, 5, 745);
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, option, anchor);
    			append_dev(option, t);
    		},
    		p: noop,
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(option);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_each_block$2.name,
    		type: "each",
    		source: "(32:4) {#each transitions as { label }",
    		ctx
    	});

    	return block;
    }

    function create_fragment$7(ctx) {
    	let div2;
    	let div0;
    	let h2;
    	let t0;
    	let t1;
    	let t2;
    	let div1;
    	let label;
    	let t3;
    	let select;
    	let t4;
    	let links;
    	let t5;
    	let stackrouter;
    	let current;
    	let mounted;
    	let dispose;
    	let each_value = /*transitions*/ ctx[3];
    	validate_each_argument(each_value);
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	links = new Links({ $$inline: true });

    	stackrouter = new StackRouter({
    			props: {
    				routes,
    				transitionFn: /*transition*/ ctx[1].fn
    			},
    			$$inline: true
    		});

    	stackrouter.$on("navigation-end", console.log);
    	stackrouter.$on("navigation-start", console.log);
    	stackrouter.$on("error", console.error);

    	const block = {
    		c: function create() {
    			div2 = element("div");
    			div0 = element("div");
    			h2 = element("h2");
    			t0 = text("Location pathname: ");
    			t1 = text(/*$pathname*/ ctx[2]);
    			t2 = space();
    			div1 = element("div");
    			label = element("label");
    			t3 = text("Transition:\n\t\t\t");
    			select = element("select");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			t4 = space();
    			create_component(links.$$.fragment);
    			t5 = space();
    			create_component(stackrouter.$$.fragment);
    			add_location(h2, file$6, 25, 2, 552);
    			set_style(div0, "text-align", "center");
    			add_location(div0, file$6, 24, 1, 517);
    			if (/*transitionIndex*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[4].call(select));
    			add_location(select, file$6, 30, 3, 662);
    			add_location(label, file$6, 28, 2, 636);
    			set_style(div1, "text-align", "center");
    			add_location(div1, file$6, 27, 1, 601);
    			set_style(div2, "padding", "10px");
    			set_style(div2, "overflow", "hidden");
    			add_location(div2, file$6, 23, 0, 470);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			insert_dev(target, div2, anchor);
    			append_dev(div2, div0);
    			append_dev(div0, h2);
    			append_dev(h2, t0);
    			append_dev(h2, t1);
    			append_dev(div2, t2);
    			append_dev(div2, div1);
    			append_dev(div1, label);
    			append_dev(label, t3);
    			append_dev(label, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*transitionIndex*/ ctx[0]);
    			append_dev(div2, t4);
    			mount_component(links, div2, null);
    			append_dev(div2, t5);
    			mount_component(stackrouter, div2, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen_dev(select, "change", /*select_change_handler*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p: function update(ctx, [dirty]) {
    			if (!current || dirty & /*$pathname*/ 4) set_data_dev(t1, /*$pathname*/ ctx[2]);

    			if (dirty & /*transitions*/ 8) {
    				each_value = /*transitions*/ ctx[3];
    				validate_each_argument(each_value);
    				let i;

    				for (i = 0; i < each_value.length; i += 1) {
    					const child_ctx = get_each_context$2(ctx, each_value, i);

    					if (each_blocks[i]) {
    						each_blocks[i].p(child_ctx, dirty);
    					} else {
    						each_blocks[i] = create_each_block$2(child_ctx);
    						each_blocks[i].c();
    						each_blocks[i].m(select, null);
    					}
    				}

    				for (; i < each_blocks.length; i += 1) {
    					each_blocks[i].d(1);
    				}

    				each_blocks.length = each_value.length;
    			}

    			if (dirty & /*transitionIndex*/ 1) {
    				select_option(select, /*transitionIndex*/ ctx[0]);
    			}

    			const stackrouter_changes = {};
    			if (dirty & /*transition*/ 2) stackrouter_changes.transitionFn = /*transition*/ ctx[1].fn;
    			stackrouter.$set(stackrouter_changes);
    		},
    		i: function intro(local) {
    			if (current) return;
    			transition_in(links.$$.fragment, local);
    			transition_in(stackrouter.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(links.$$.fragment, local);
    			transition_out(stackrouter.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			if (detaching) detach_dev(div2);
    			destroy_each(each_blocks, detaching);
    			destroy_component(links);
    			destroy_component(stackrouter);
    			mounted = false;
    			dispose();
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$7.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$7($$self, $$props, $$invalidate) {
    	let $pathname;
    	validate_store(pathname, "pathname");
    	component_subscribe($$self, pathname, $$value => $$invalidate(2, $pathname = $$value));
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("Layout", slots, []);

    	let transitions = [
    		{ label: "dive", fn: dive(300) },
    		{ label: "slide", fn: slide(300) },
    		{ label: "none", fn: noAnimation() }
    	];

    	let transitionIndex = 0;
    	let transition = transitions[transitionIndex];
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console_1.warn(`<Layout> was created with unknown prop '${key}'`);
    	});

    	function select_change_handler() {
    		transitionIndex = select_value(this);
    		$$invalidate(0, transitionIndex);
    	}

    	$$self.$capture_state = () => ({
    		StackRouter,
    		slide,
    		dive,
    		noAnimation,
    		pathname,
    		routes,
    		Links,
    		transitions,
    		transitionIndex,
    		transition,
    		$pathname
    	});

    	$$self.$inject_state = $$props => {
    		if ("transitions" in $$props) $$invalidate(3, transitions = $$props.transitions);
    		if ("transitionIndex" in $$props) $$invalidate(0, transitionIndex = $$props.transitionIndex);
    		if ("transition" in $$props) $$invalidate(1, transition = $$props.transition);
    	};

    	if ($$props && "$$inject" in $$props) {
    		$$self.$inject_state($$props.$$inject);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*transitionIndex*/ 1) {
    			 ($$invalidate(1, transition = transitions[transitionIndex]));
    		}
    	};

    	return [transitionIndex, transition, $pathname, transitions, select_change_handler];
    }

    class Layout extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$7, create_fragment$7, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "Layout",
    			options,
    			id: create_fragment$7.name
    		});
    	}
    }

    /* src/App.svelte generated by Svelte v3.38.2 */

    function create_fragment$8(ctx) {
    	let layout;
    	let current;
    	layout = new Layout({ $$inline: true });

    	const block = {
    		c: function create() {
    			create_component(layout.$$.fragment);
    		},
    		l: function claim(nodes) {
    			throw new Error("options.hydrate only works if the component was compiled with the `hydratable: true` option");
    		},
    		m: function mount(target, anchor) {
    			mount_component(layout, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i: function intro(local) {
    			if (current) return;
    			transition_in(layout.$$.fragment, local);
    			current = true;
    		},
    		o: function outro(local) {
    			transition_out(layout.$$.fragment, local);
    			current = false;
    		},
    		d: function destroy(detaching) {
    			destroy_component(layout, detaching);
    		}
    	};

    	dispatch_dev("SvelteRegisterBlock", {
    		block,
    		id: create_fragment$8.name,
    		type: "component",
    		source: "",
    		ctx
    	});

    	return block;
    }

    function instance$8($$self, $$props, $$invalidate) {
    	let { $$slots: slots = {}, $$scope } = $$props;
    	validate_slots("App", slots, []);
    	const writable_props = [];

    	Object.keys($$props).forEach(key => {
    		if (!~writable_props.indexOf(key) && key.slice(0, 2) !== "$$") console.warn(`<App> was created with unknown prop '${key}'`);
    	});

    	$$self.$capture_state = () => ({ Layout });
    	return [];
    }

    class App extends SvelteComponentDev {
    	constructor(options) {
    		super(options);
    		init(this, options, instance$8, create_fragment$8, safe_not_equal, {});

    		dispatch_dev("SvelteRegisterComponent", {
    			component: this,
    			tagName: "App",
    			options,
    			id: create_fragment$8.name
    		});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {},
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
