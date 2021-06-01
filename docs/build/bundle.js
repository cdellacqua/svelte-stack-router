var StackRouter = (function () {
    'use strict';

    function noop() { }
    const identity = x => x;
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
    function set_data(text, data) {
        data = '' + data;
        if (text.wholeText !== data)
            text.data = data;
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
    function commonTransitionGenerator(duration, styleGenerators) {
        return async (transitionFunctionData) => {
            const timestamp = new Date().getTime();
            const unloadClass = `unload-${timestamp}`;
            const loadClass = `load-${timestamp}`;
            const routerClass = `router-${timestamp}`;
            const { mountPointToUnload, mountPointToLoad, scroll, routerMountPoint, } = transitionFunctionData;
            mountPointToUnload === null || mountPointToUnload === void 0 ? void 0 : mountPointToUnload.classList.add(unloadClass);
            mountPointToLoad.classList.add(loadClass);
            routerMountPoint.classList.add(routerClass);
            const styleNodes = new Array(styleGenerators.length);
            for (let i = 0; i < styleGenerators.length; i++) {
                const styleNode = styleGenerators[i](loadClass, unloadClass, routerClass, transitionFunctionData);
                styleNodes[i] = styleNode;
                document.head.appendChild(styleNode);
                await animationFrame();
                await animationFrame();
                await animationFrame();
            }
            await sleep(duration);
            window.scrollTo(scroll.x, scroll.y);
            if (window.getComputedStyle(document.documentElement).scrollBehavior === 'smooth') {
                // At the moment of writing this comment there is no official/simple way to wait for the
                // window.scrollTo method to complete the animation
                // Hack: loop for a maximum of 500ms checking if the scroll position is close enough to the target scroll
                const threshold = 5;
                for (let i = 0; i < 50; i++) {
                    if (Math.sqrt(Math.pow(window.scrollX - scroll.x, 2)
                        + Math.pow(window.scrollY - scroll.y, 2)) < threshold) {
                        break;
                    }
                    await sleep(10);
                }
            }
            for (const styleNode of styleNodes) {
                document.head.removeChild(styleNode);
            }
            mountPointToUnload === null || mountPointToUnload === void 0 ? void 0 : mountPointToUnload.classList.remove(unloadClass);
            mountPointToLoad.classList.remove(loadClass);
            routerMountPoint.classList.remove(routerClass);
        };
    }
    function slide(duration) {
        return commonTransitionGenerator(duration, [
            (loadClass, unloadClass, routerClass, { navigationType, }) => makeStyleTag(`
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
					transform: translateX(${navigationType === NavigationType.GoBackward ? '-' : ''}50%);
				}
				.${unloadClass} {
					position: relative;
					z-index: 1;
					opacity: 1;
					transform: translateX(0%);
				}
				.${routerClass} {
					position: relative;
					overflow: hidden;
				}
			`),
            (_1, _2, routerClass, { mountPointToLoad, mountPointToUnload, }) => makeStyleTag(`
				.${routerClass} {
					min-height: ${Math.max(mountPointToLoad.offsetHeight, (mountPointToUnload === null || mountPointToUnload === void 0 ? void 0 : mountPointToUnload.offsetHeight) || 0)}px;
					min-width: ${Math.max(mountPointToLoad.offsetWidth, (mountPointToUnload === null || mountPointToUnload === void 0 ? void 0 : mountPointToUnload.offsetWidth) || 0)}px;
				}
			`),
            (loadClass, unloadClass, _, { navigationType }) => makeStyleTag(`
				.${loadClass} {
					transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear ${Math.floor(duration / 2)}ms;
					opacity: 1;
					transform: translateX(0%);
				}
				.${unloadClass} {
					transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear;
					opacity: 0;
					transform: translateX(${navigationType === NavigationType.GoBackward ? '' : '-'}50%);
				}
			`),
        ]);
    }
    function dive(duration) {
        return commonTransitionGenerator(duration, [
            (loadClass, unloadClass, routerClass, { navigationType }) => makeStyleTag(`
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
					transform: translateZ(${navigationType === NavigationType.GoBackward ? '' : '-'}150px);
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
					overflow: hidden;
				}
			`),
            (_1, _2, routerClass, { mountPointToLoad, mountPointToUnload, }) => makeStyleTag(`
				.${routerClass} {
					min-height: ${Math.max(mountPointToLoad.offsetHeight, (mountPointToUnload === null || mountPointToUnload === void 0 ? void 0 : mountPointToUnload.offsetHeight) || 0)}px;
					min-width: ${Math.max(mountPointToLoad.offsetWidth, (mountPointToUnload === null || mountPointToUnload === void 0 ? void 0 : mountPointToUnload.offsetWidth) || 0)}px;
				}
			`),
            (loadClass, unloadClass, _, { navigationType }) => makeStyleTag(`
				.${loadClass} {
					transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear ${Math.floor(duration / 2)}ms;
					opacity: 1;
					transform: translateZ(0px);
				}
				.${unloadClass} {
					transition: transform ${duration}ms, opacity ${Math.floor(duration / 2)}ms linear;
					opacity: 0;
					transform: translateZ(${navigationType === NavigationType.GoBackward ? '-' : ''}150px);
				}
			`),
        ]);
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

    function create_fragment(ctx) {
    	let div;

    	return {
    		c() {
    			div = element("div");
    			attr(div, "class", "stack-router-mount-point");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			/*div_binding*/ ctx[6](div);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			/*div_binding*/ ctx[6](null);
    		}
    	};
    }

    function instance($$self, $$props, $$invalidate) {
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

    class StackRouter extends SvelteComponent {
    	constructor(options) {
    		super();

    		init(this, options, instance, create_fragment, safe_not_equal, {
    			defaultResumable: 1,
    			useHash: 2,
    			restoreScroll: 3,
    			transitionFn: 4,
    			routes: 5
    		});
    	}
    }

    /* src/pages/Home.svelte generated by Svelte v3.38.2 */

    function create_fragment$1(ctx) {
    	let div0;
    	let t1;
    	let div1;
    	let t3;
    	let div2;

    	return {
    		c() {
    			div0 = element("div");
    			div0.innerHTML = `<h1>Welcome to svelte-stack-router</h1>`;
    			t1 = space();
    			div1 = element("div");
    			div1.innerHTML = `<h2>A fast, app-like router that caches components</h2>`;
    			t3 = space();
    			div2 = element("div");
    			div2.innerHTML = `<p>Less re-renders, full state preservation and cool animations!</p>`;
    			set_style(div0, "text-align", "center");
    			set_style(div1, "text-align", "center");
    			set_style(div2, "text-align", "center");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t1, anchor);
    			insert(target, div1, anchor);
    			insert(target, t3, anchor);
    			insert(target, div2, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div1);
    			if (detaching) detach(t3);
    			if (detaching) detach(div2);
    		}
    	};
    }

    class Home extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$1, safe_not_equal, {});
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

    function get_each_context(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[11] = list[i];
    	return child_ctx;
    }

    // (110:1) {#if params.aVariable}
    function create_if_block(ctx) {
    	let p;
    	let t0;
    	let t1_value = /*params*/ ctx[0].aVariable + "";
    	let t1;
    	let t2;
    	let p_resize_listener;
    	let p_transition;
    	let current;

    	return {
    		c() {
    			p = element("p");
    			t0 = text("I have a param! \"");
    			t1 = text(t1_value);
    			t2 = text("\"");
    			set_style(p, "margin", "0");
    			set_style(p, "display", "inline-block");
    			set_style(p, "padding", "10px");
    			set_style(p, "border-radius", "100px");
    			set_style(p, "background-color", "black");
    			add_render_callback(() => /*p_elementresize_handler*/ ctx[6].call(p));
    		},
    		m(target, anchor) {
    			insert(target, p, anchor);
    			append(p, t0);
    			append(p, t1);
    			append(p, t2);
    			p_resize_listener = add_resize_listener(p, /*p_elementresize_handler*/ ctx[6].bind(p));
    			current = true;
    		},
    		p(ctx, dirty) {
    			if ((!current || dirty & /*params*/ 1) && t1_value !== (t1_value = /*params*/ ctx[0].aVariable + "")) set_data(t1, t1_value);
    		},
    		i(local) {
    			if (current) return;

    			add_render_callback(() => {
    				if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: -10, duration: 200 }, true);
    				p_transition.run(1);
    			});

    			current = true;
    		},
    		o(local) {
    			if (!p_transition) p_transition = create_bidirectional_transition(p, fly, { y: -10, duration: 200 }, false);
    			p_transition.run(0);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(p);
    			p_resize_listener();
    			if (detaching && p_transition) p_transition.end();
    		}
    	};
    }

    // (130:2) {#each events as event}
    function create_each_block(ctx) {
    	let li;
    	let t0_value = /*event*/ ctx[11] + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = space();
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*events*/ 2 && t0_value !== (t0_value = /*event*/ ctx[11] + "")) set_data(t0, t0_value);
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    function create_fragment$2(ctx) {
    	let div0;
    	let t1;
    	let div1;
    	let label;
    	let input;
    	let t2;
    	let t3;
    	let div2;
    	let t4;
    	let div3;
    	let p;
    	let t8;
    	let video;
    	let video_src_value;
    	let t9;
    	let div4;
    	let t11;
    	let div5;
    	let ul;
    	let current;
    	let mounted;
    	let dispose;
    	let if_block = /*params*/ ctx[0].aVariable && create_if_block(ctx);
    	let each_value = /*events*/ ctx[1];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block(get_each_context(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div0 = element("div");
    			div0.innerHTML = `<h1>I&#39;m a resumable component</h1>`;
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
    			p = element("p");

    			p.innerHTML = `This component <strong>will</strong> get cached. As a result the following video
		will be paused and resumed every time you visit this page`;

    			t8 = space();
    			video = element("video");
    			t9 = space();
    			div4 = element("div");
    			div4.textContent = "Events so far:";
    			t11 = space();
    			div5 = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			set_style(div0, "text-align", "center");
    			attr(input, "type", "checkbox");
    			input.checked = /*wait1s*/ ctx[2];
    			set_style(label, "background-color", "black");
    			set_style(label, "padding", "10px");
    			set_style(label, "display", "inline-block");
    			set_style(label, "border-radius", "100px");
    			set_style(div1, "text-align", "center");
    			set_style(div1, "margin-bottom", "10px");
    			set_style(div2, "transition", "height 200ms ease");

    			set_style(div2, "height", (/*params*/ ctx[0].aVariable
    			? /*pOffsetHeight*/ ctx[4]
    			: 0) + "px");

    			if (video.src !== (video_src_value = "bunny.mp4")) attr(video, "src", video_src_value);
    			video.autoplay = true;
    			video.muted = true;
    			video.controls = true;
    			set_style(div3, "padding-top", "10px");
    			set_style(div4, "padding-top", "10px");
    			set_style(ul, "display", "inline-block");
    			set_style(ul, "margin", "0");
    			set_style(ul, "text-align", "left");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t1, anchor);
    			insert(target, div1, anchor);
    			append(div1, label);
    			append(label, input);
    			append(label, t2);
    			insert(target, t3, anchor);
    			insert(target, div2, anchor);
    			if (if_block) if_block.m(div2, null);
    			insert(target, t4, anchor);
    			insert(target, div3, anchor);
    			append(div3, p);
    			append(div3, t8);
    			append(div3, video);
    			/*video_binding*/ ctx[7](video);
    			insert(target, t9, anchor);
    			insert(target, div4, anchor);
    			insert(target, t11, anchor);
    			insert(target, div5, anchor);
    			append(div5, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}

    			current = true;

    			if (!mounted) {
    				dispose = listen(input, "change", /*change_handler*/ ctx[5]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*wait1s*/ 4) {
    				input.checked = /*wait1s*/ ctx[2];
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

    			if (!current || dirty & /*params, pOffsetHeight*/ 17) {
    				set_style(div2, "height", (/*params*/ ctx[0].aVariable
    				? /*pOffsetHeight*/ ctx[4]
    				: 0) + "px");
    			}

    			if (dirty & /*events*/ 2) {
    				each_value = /*events*/ ctx[1];
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
    		i(local) {
    			if (current) return;
    			transition_in(if_block);
    			current = true;
    		},
    		o(local) {
    			transition_out(if_block);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div1);
    			if (detaching) detach(t3);
    			if (detaching) detach(div2);
    			if (if_block) if_block.d();
    			if (detaching) detach(t4);
    			if (detaching) detach(div3);
    			/*video_binding*/ ctx[7](null);
    			if (detaching) detach(t9);
    			if (detaching) detach(div4);
    			if (detaching) detach(t11);
    			if (detaching) detach(div5);
    			destroy_each(each_blocks, detaching);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$1($$self, $$props, $$invalidate) {
    	let { params = { aVariable: null } } = $$props;
    	let events = [];
    	let wait1s = false;

    	/** @type {HTMLVideoElement} */
    	let videoRef;

    	let videoWasPlaying = true;

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
    		if (videoWasPlaying) {
    			$$invalidate(1, events = [...events, "onAfterLoad, resuming video"]);
    			videoRef?.play();
    		} else {
    			$$invalidate(1, events = [...events, "onAfterLoad"]);
    		}
    	});

    	onBeforeUnload(() => {
    		if (wait1s) {
    			$$invalidate(1, events = [
    				...events,
    				"onBeforeUnload. I'll just wait 1s before letting the router unload me"
    			]);

    			return new Promise(res => setTimeout(res, 1000));
    		} else {
    			$$invalidate(1, events = [...events, "onBeforeUnload"]);
    		}
    	});

    	onPause(() => {
    		let message = "onPause";

    		if (videoRef && !videoRef.paused) {
    			message += ", pausing video";
    			videoRef.pause();
    			videoWasPlaying = true;
    		} else {
    			videoWasPlaying = false;
    		}

    		$$invalidate(1, events = [...events, message]);
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
    	const change_handler = ({ target }) => $$invalidate(2, wait1s = target.checked);

    	function p_elementresize_handler() {
    		pOffsetHeight = this.offsetHeight;
    		$$invalidate(4, pOffsetHeight);
    	}

    	function video_binding($$value) {
    		binding_callbacks[$$value ? "unshift" : "push"](() => {
    			videoRef = $$value;
    			$$invalidate(3, videoRef);
    		});
    	}

    	$$self.$$set = $$props => {
    		if ("params" in $$props) $$invalidate(0, params = $$props.params);
    	};

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*params*/ 1) {
    			 (onParamsChange());
    		}
    	};

    	return [
    		params,
    		events,
    		wait1s,
    		videoRef,
    		pOffsetHeight,
    		change_handler,
    		p_elementresize_handler,
    		video_binding
    	];
    }

    class Resumable extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$1, create_fragment$2, safe_not_equal, { params: 0 });
    	}
    }

    /* src/pages/Throwaway.svelte generated by Svelte v3.38.2 */

    function get_each_context$1(ctx, list, i) {
    	const child_ctx = ctx.slice();
    	child_ctx[1] = list[i];
    	return child_ctx;
    }

    // (62:2) {#each events as event}
    function create_each_block$1(ctx) {
    	let li;
    	let t0_value = /*event*/ ctx[1] + "";
    	let t0;
    	let t1;

    	return {
    		c() {
    			li = element("li");
    			t0 = text(t0_value);
    			t1 = space();
    		},
    		m(target, anchor) {
    			insert(target, li, anchor);
    			append(li, t0);
    			append(li, t1);
    		},
    		p(ctx, dirty) {
    			if (dirty & /*events*/ 1 && t0_value !== (t0_value = /*event*/ ctx[1] + "")) set_data(t0, t0_value);
    		},
    		d(detaching) {
    			if (detaching) detach(li);
    		}
    	};
    }

    function create_fragment$3(ctx) {
    	let div0;
    	let t1;
    	let div1;
    	let t6;
    	let div2;
    	let t8;
    	let div3;
    	let ul;
    	let each_value = /*events*/ ctx[0];
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$1(get_each_context$1(ctx, each_value, i));
    	}

    	return {
    		c() {
    			div0 = element("div");
    			div0.innerHTML = `<h1>I&#39;m a non-resumable component</h1>`;
    			t1 = space();
    			div1 = element("div");

    			div1.innerHTML = `<p>This component <strong>won&#39;t</strong> get cached. As a result the following video
		will restart every time you visit this page</p> 
	<video src="bunny.mp4" autoplay="" muted="" controls=""></video>`;

    			t6 = space();
    			div2 = element("div");
    			div2.textContent = "Events so far:";
    			t8 = space();
    			div3 = element("div");
    			ul = element("ul");

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].c();
    			}

    			set_style(div0, "text-align", "center");
    			set_style(div1, "padding-top", "10px");
    			set_style(div2, "padding-top", "10px");
    			set_style(ul, "display", "inline-block");
    			set_style(ul, "margin", "0");
    			set_style(ul, "text-align", "left");
    		},
    		m(target, anchor) {
    			insert(target, div0, anchor);
    			insert(target, t1, anchor);
    			insert(target, div1, anchor);
    			insert(target, t6, anchor);
    			insert(target, div2, anchor);
    			insert(target, t8, anchor);
    			insert(target, div3, anchor);
    			append(div3, ul);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(ul, null);
    			}
    		},
    		p(ctx, [dirty]) {
    			if (dirty & /*events*/ 1) {
    				each_value = /*events*/ ctx[0];
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
    		d(detaching) {
    			if (detaching) detach(div0);
    			if (detaching) detach(t1);
    			if (detaching) detach(div1);
    			if (detaching) detach(t6);
    			if (detaching) detach(div2);
    			if (detaching) detach(t8);
    			if (detaching) detach(div3);
    			destroy_each(each_blocks, detaching);
    		}
    	};
    }

    function instance$2($$self, $$props, $$invalidate) {
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

    	return [events];
    }

    class Throwaway extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$2, create_fragment$3, safe_not_equal, {});
    	}
    }

    /* src/pages/Redirect.svelte generated by Svelte v3.38.2 */

    function create_fragment$4(ctx) {
    	let t;

    	return {
    		c() {
    			t = text("I'm temporary... just wait a sec...");
    		},
    		m(target, anchor) {
    			insert(target, t, anchor);
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(t);
    		}
    	};
    }

    function instance$3($$self) {
    	replace("/");
    	setResumable(false);
    	return [];
    }

    class Redirect extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$3, create_fragment$4, safe_not_equal, {});
    	}
    }

    /* src/pages/NotFound.svelte generated by Svelte v3.38.2 */

    function create_fragment$5(ctx) {
    	let div;
    	let t1;
    	let a;
    	let link_action;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			div = element("div");
    			div.innerHTML = `<h1>Not found</h1>`;
    			t1 = space();
    			a = element("a");
    			a.textContent = "Redirect";
    			set_style(div, "text-align", "center");
    			attr(a, "href", "/redirect");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			insert(target, t1, anchor);
    			insert(target, a, anchor);

    			if (!mounted) {
    				dispose = action_destroyer(link_action = link.call(null, a));
    				mounted = true;
    			}
    		},
    		p: noop,
    		i: noop,
    		o: noop,
    		d(detaching) {
    			if (detaching) detach(div);
    			if (detaching) detach(t1);
    			if (detaching) detach(a);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    class NotFound extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$5, safe_not_equal, {});
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

    function create_if_block$1(ctx) {
    	let button;
    	let mounted;
    	let dispose;

    	return {
    		c() {
    			button = element("button");
    			button.textContent = "Go back passing a returnValue";
    		},
    		m(target, anchor) {
    			insert(target, button, anchor);

    			if (!mounted) {
    				dispose = listen(button, "click", /*click_handler*/ ctx[2]);
    				mounted = true;
    			}
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(button);
    			mounted = false;
    			dispose();
    		}
    	};
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
    	let a4;
    	let link_action_4;
    	let t9;
    	let mounted;
    	let dispose;
    	let if_block = /*historyLength*/ ctx[0] > 2 && create_if_block$1(ctx);

    	return {
    		c() {
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
    			a4 = element("a");
    			a4.textContent = "Go to 404";
    			t9 = space();
    			if (if_block) if_block.c();
    			attr(a0, "href", "/");
    			attr(a1, "href", "/resumable");
    			attr(a2, "href", "/resumable/here you go!");
    			attr(a3, "href", "/throwaway");
    			attr(a4, "href", "/unregistered-route");
    			set_style(div, "text-align", "center");
    			set_style(div, "margin-bottom", "20px");
    		},
    		m(target, anchor) {
    			insert(target, div, anchor);
    			append(div, a0);
    			append(div, t1);
    			append(div, a1);
    			append(div, t3);
    			append(div, a2);
    			append(div, t5);
    			append(div, a3);
    			append(div, t7);
    			append(div, a4);
    			append(div, t9);
    			if (if_block) if_block.m(div, null);

    			if (!mounted) {
    				dispose = [
    					action_destroyer(link_action = link.call(null, a0)),
    					action_destroyer(link_action_1 = link.call(null, a1)),
    					action_destroyer(link_action_2 = link.call(null, a2)),
    					action_destroyer(link_action_3 = link.call(null, a3)),
    					action_destroyer(link_action_4 = link.call(null, a4))
    				];

    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
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
    		d(detaching) {
    			if (detaching) detach(div);
    			if (if_block) if_block.d();
    			mounted = false;
    			run_all(dispose);
    		}
    	};
    }

    function instance$4($$self, $$props, $$invalidate) {
    	let $location;
    	component_subscribe($$self, location, $$value => $$invalidate(1, $location = $$value));
    	let historyLength = window.history.length;
    	const click_handler = () => pop("bye!");

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*$location*/ 2) {
    			 ($$invalidate(0, historyLength = window.history.length));
    		}
    	};

    	return [historyLength, $location, click_handler];
    }

    class Links extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$4, create_fragment$6, safe_not_equal, {});
    	}
    }

    /* src/pages/_Layout.svelte generated by Svelte v3.38.2 */

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

    	return {
    		c() {
    			option = element("option");
    			t = text(t_value);
    			option.__value = option_value_value = /*i*/ ctx[7];
    			option.value = option.__value;
    		},
    		m(target, anchor) {
    			insert(target, option, anchor);
    			append(option, t);
    		},
    		p: noop,
    		d(detaching) {
    			if (detaching) detach(option);
    		}
    	};
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
    	let each_blocks = [];

    	for (let i = 0; i < each_value.length; i += 1) {
    		each_blocks[i] = create_each_block$2(get_each_context$2(ctx, each_value, i));
    	}

    	links = new Links({});

    	stackrouter = new StackRouter({
    			props: {
    				routes,
    				transitionFn: /*transition*/ ctx[1].fn
    			}
    		});

    	stackrouter.$on("navigation-end", console.log);
    	stackrouter.$on("navigation-start", console.log);
    	stackrouter.$on("error", console.error);

    	return {
    		c() {
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
    			set_style(div0, "text-align", "center");
    			if (/*transitionIndex*/ ctx[0] === void 0) add_render_callback(() => /*select_change_handler*/ ctx[4].call(select));
    			set_style(div1, "text-align", "center");
    			set_style(div2, "padding", "10px");
    			set_style(div2, "overflow", "hidden");
    		},
    		m(target, anchor) {
    			insert(target, div2, anchor);
    			append(div2, div0);
    			append(div0, h2);
    			append(h2, t0);
    			append(h2, t1);
    			append(div2, t2);
    			append(div2, div1);
    			append(div1, label);
    			append(label, t3);
    			append(label, select);

    			for (let i = 0; i < each_blocks.length; i += 1) {
    				each_blocks[i].m(select, null);
    			}

    			select_option(select, /*transitionIndex*/ ctx[0]);
    			append(div2, t4);
    			mount_component(links, div2, null);
    			append(div2, t5);
    			mount_component(stackrouter, div2, null);
    			current = true;

    			if (!mounted) {
    				dispose = listen(select, "change", /*select_change_handler*/ ctx[4]);
    				mounted = true;
    			}
    		},
    		p(ctx, [dirty]) {
    			if (!current || dirty & /*$pathname*/ 4) set_data(t1, /*$pathname*/ ctx[2]);

    			if (dirty & /*transitions*/ 8) {
    				each_value = /*transitions*/ ctx[3];
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
    		i(local) {
    			if (current) return;
    			transition_in(links.$$.fragment, local);
    			transition_in(stackrouter.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(links.$$.fragment, local);
    			transition_out(stackrouter.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			if (detaching) detach(div2);
    			destroy_each(each_blocks, detaching);
    			destroy_component(links);
    			destroy_component(stackrouter);
    			mounted = false;
    			dispose();
    		}
    	};
    }

    function instance$5($$self, $$props, $$invalidate) {
    	let $pathname;
    	component_subscribe($$self, pathname, $$value => $$invalidate(2, $pathname = $$value));

    	let transitions = [
    		{ label: "dive", fn: dive(300) },
    		{ label: "slide", fn: slide(300) },
    		{ label: "none", fn: noAnimation() }
    	];

    	let transitionIndex = 0;
    	let transition = transitions[transitionIndex];

    	function select_change_handler() {
    		transitionIndex = select_value(this);
    		$$invalidate(0, transitionIndex);
    	}

    	$$self.$$.update = () => {
    		if ($$self.$$.dirty & /*transitionIndex*/ 1) {
    			 ($$invalidate(1, transition = transitions[transitionIndex]));
    		}
    	};

    	return [transitionIndex, transition, $pathname, transitions, select_change_handler];
    }

    class Layout extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, instance$5, create_fragment$7, safe_not_equal, {});
    	}
    }

    /* src/App.svelte generated by Svelte v3.38.2 */

    function create_fragment$8(ctx) {
    	let layout;
    	let current;
    	layout = new Layout({});

    	return {
    		c() {
    			create_component(layout.$$.fragment);
    		},
    		m(target, anchor) {
    			mount_component(layout, target, anchor);
    			current = true;
    		},
    		p: noop,
    		i(local) {
    			if (current) return;
    			transition_in(layout.$$.fragment, local);
    			current = true;
    		},
    		o(local) {
    			transition_out(layout.$$.fragment, local);
    			current = false;
    		},
    		d(detaching) {
    			destroy_component(layout, detaching);
    		}
    	};
    }

    class App extends SvelteComponent {
    	constructor(options) {
    		super();
    		init(this, options, null, create_fragment$8, safe_not_equal, {});
    	}
    }

    const app = new App({
    	target: document.body,
    	props: {},
    });

    return app;

}());
//# sourceMappingURL=bundle.js.map
