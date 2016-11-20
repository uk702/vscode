<div class="show-content"><blockquote><p>说到c++编译运行，大家第一个想到的应该是VS2015这种微软出的大型IDE，对于一些大型项目也确实应该使用VS这种大型的IDE，但是作为一个业余的爱好者，只是想使用c++来运行一些东西，比如一些算法问题，那么VS这种大型的IDE就显得鸡肋，还会消耗不必要的内存，这个时候VSCode这种可安装插件的编辑器就显得非常高效。</p></blockquote>
<h1>主要步骤</h1>
<ul>
<li>安装VSCode</li>
<li>在VSCode内安装c++插件</li>
<li>安装g++编译、调试环境</li>
<li>修改VSCode调试配置文件</li>
</ul>
<h1>安装VSCode</h1>
<p><a href="https://code.visualstudio.com/?utm_expid=101350005-25.TcgI322oRoCwQD7KJ5t8zQ.0" target="_blank">VSCode下载地址</a><br>按照步骤安装</p>
<h1>在VSCode内安装c++插件</h1>
<p>Ctrl+P之后输入</p>
<pre class="hljs sql"><code class="sql">ext <span class="hljs-operator"><span class="hljs-keyword">install</span> <span class="hljs-keyword">c</span>++</span></code></pre>
<div class="image-package imagebubble" widget="ImageBubble">
<img src="http://upload-images.jianshu.io/upload_images/2419083-771cca4e1307dcd3.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240" data-original-src="http://upload-images.jianshu.io/upload_images/2419083-771cca4e1307dcd3.png?imageMogr2/auto-orient/strip%7CimageView2/2" class="imagebubble-image"><br><div class="image-caption">Paste_Image.png</div>
</div>
<p>安装左边第一个c/c++的插件（微软的官方插件）。<br>安装完成之后重启VSCode生效。</p>
<h1>安装g++编译、调试环境</h1>
<p>目前windows下调试仅支持 Cygwin 和 MinGW。这里使用的是MinGW.<br><strong><a href="https://sourceforge.net/projects/mingw/files/latest/download?source=files" target="_blank">Download mingw-get-setup.exe (86.5 kB)</a></strong></p>
<p>按照流程安装，安装完之后打开界面：</p>
<div class="image-package imagebubble" widget="ImageBubble">
<img src="http://upload-images.jianshu.io/upload_images/2419083-3b225e8185a546ac.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240" data-original-src="http://upload-images.jianshu.io/upload_images/2419083-3b225e8185a546ac.png?imageMogr2/auto-orient/strip%7CimageView2/2" class="imagebubble-image"><br><div class="image-caption">Paste_Image.png</div>
</div><p><br>安装此处选中的模块。全选中之后按左上角Installationt-&gt;Apply Changes进行安装（最好翻墙）。<br><strong><em>然后配置环境变量</em></strong><br>别忘了这步就好（不懂配置的可以自己搜索，配环境变量应该是对程序员而言最见到那的事了）<br>有时候修改环境变量需要重启计算机</p>
<h1>修改VSCode调试配置文件</h1>
<p>用VSCode打开一个文件夹（因为VSCode会生成一个配置文件，所以必须在一个文件夹内运行）<br>新建一个a.cpp<br>写一个最简单的程序</p>
<div class="image-package imagebubble" widget="ImageBubble">
<img src="http://upload-images.jianshu.io/upload_images/2419083-daca50e608f0ba0a.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240" data-original-src="http://upload-images.jianshu.io/upload_images/2419083-daca50e608f0ba0a.png?imageMogr2/auto-orient/strip%7CimageView2/2" class="imagebubble-image"><br><div class="image-caption">Paste_Image.png</div>
</div><p><br>点击右边的蜘蛛，再点击左边调试栏上方的设置按钮，选择c++编译环境，将launch.json的文件内容替换成如下：</p>
<p><pre>
```
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "C++ Launch (GDB)",                 // 配置名称，将会在启动配置的下拉菜单中显示
            "type": "cppdbg",                           // 配置类型，这里只能为cppdbg
            "request": "launch",                        // 请求配置类型，可以为launch（启动）或attach（附加）
            "launchOptionType": "Local",                // 调试器启动类型，这里只能为Local
            "targetArchitecture": "x86",                // 生成目标架构，一般为x86或x64，可以为x86, arm, arm64, mips, x64, amd64, x86_64
            "program": "$${file}.exe",                   // 将要进行调试的程序的路径
            "miDebuggerPath":"c:\\MinGW\\bin\\gdb.exe", // miDebugger的路径，注意这里要与MinGw的路径对应
            "args": ["blackkitty",  "1221", "# #"],     // 程序调试时传递给程序的命令行参数，一般设为空即可
            "stopAtEntry": false,                       // 设为true时程序将暂停在程序入口处，一般设置为false
            "cwd": "$${workspaceRoot}",                  // 调试程序时的工作目录，一般为$${workspaceRoot}即代码所在目录
            "externalConsole": true,                    // 调试时是否显示控制台窗口，一般设置为true显示控制台
            "preLaunchTask": "g++"　　                  // 调试会话开始前执行的任务，一般为编译程序，c++为g++, c为gcc
        }
    ]
}
```
</pre></p>
<p><strong>注意miDebuggerPath要与MinGw的路径对应</strong><br>
<p><br>替换后保存，然后切换至a.cpp，按F5进行调试，此时会弹出一个信息框要求你配置任务运行程序，点击它~<br>选择任务运行程序，点击Others，跳出tasks.json的配置文件。<br>替换成如下代码</p>
<pre class="hljs sql"><code class="sql">{
    "version": "<span class="hljs-operator">0.<span class="hljs-number">1.0</span><span class="hljs-string">",
    "</span>command<span class="hljs-string">": "</span><span class="hljs-keyword">g</span>++<span class="hljs-string">",
    "</span>args<span class="hljs-string">": ["</span>-<span class="hljs-keyword">g</span><span class="hljs-string">","</span>${<span class="hljs-keyword">file</span>}<span class="hljs-string">","</span>-o<span class="hljs-string">","</span>${<span class="hljs-keyword">file</span>}.exe<span class="hljs-string">"],    // 编译命令参数
    "</span>problemMatcher<span class="hljs-string">": {
        "</span>owner<span class="hljs-string">": "</span>cpp<span class="hljs-string">",
        "</span>fileLocation<span class="hljs-string">": ["</span><span class="hljs-keyword">relative</span><span class="hljs-string">", "</span>${workspaceRoot}<span class="hljs-string">"],
        "</span>pattern<span class="hljs-string">": {
            "</span>regexp<span class="hljs-string">": "</span>^(.*):(\\<span class="hljs-keyword">d</span>+):(\\<span class="hljs-keyword">d</span>+):\\s+(<span class="hljs-keyword">warning</span>|<span class="hljs-keyword">error</span>):\\s+(.*)$<span class="hljs-string">",
            "</span><span class="hljs-keyword">file</span><span class="hljs-string">": 1,
            "</span>line<span class="hljs-string">": 2,
            "</span><span class="hljs-keyword">column</span><span class="hljs-string">": 3,
            "</span>severity<span class="hljs-string">": 4,
            "</span>message<span class="hljs-string">": 5
        }
    }
}</span></span></code></pre>
<p>保存一下，然后切换至a.cpp，再次按F5启动调试</p>
<div class="image-package imagebubble" widget="ImageBubble">
<img src="http://upload-images.jianshu.io/upload_images/2419083-ddfaedfc814c5548.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240" data-original-src="http://upload-images.jianshu.io/upload_images/2419083-ddfaedfc814c5548.png?imageMogr2/auto-orient/strip%7CimageView2/2" class="imagebubble-image"><br><div class="image-caption">Paste_Image.png</div>
</div><p><br>然后就可以设置断点调试了</p>
</div>