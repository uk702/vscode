<div class="show-content"><blockquote><p>˵��c++�������У���ҵ�һ���뵽��Ӧ����VS2015����΢����Ĵ���IDE������һЩ������ĿҲȷʵӦ��ʹ��VS���ִ��͵�IDE��������Ϊһ��ҵ��İ����ߣ�ֻ����ʹ��c++������һЩ����������һЩ�㷨���⣬��ôVS���ִ��͵�IDE���Եü��ߣ��������Ĳ���Ҫ���ڴ棬���ʱ��VSCode���ֿɰ�װ����ı༭�����Ե÷ǳ���Ч��</p></blockquote>
<h1>��Ҫ����</h1>
<ul>
<li>��װVSCode</li>
<li>��VSCode�ڰ�װc++���</li>
<li>��װg++���롢���Ի���</li>
<li>�޸�VSCode���������ļ�</li>
</ul>
<h1>��װVSCode</h1>
<p><a href="https://code.visualstudio.com/?utm_expid=101350005-25.TcgI322oRoCwQD7KJ5t8zQ.0" target="_blank">VSCode���ص�ַ</a><br>���ղ��谲װ</p>
<h1>��VSCode�ڰ�װc++���</h1>
<p>Ctrl+P֮������</p>
<pre class="hljs sql"><code class="sql">ext <span class="hljs-operator"><span class="hljs-keyword">install</span> <span class="hljs-keyword">c</span>++</span></code></pre>
<div class="image-package imagebubble" widget="ImageBubble">
<img src="http://upload-images.jianshu.io/upload_images/2419083-771cca4e1307dcd3.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240" data-original-src="http://upload-images.jianshu.io/upload_images/2419083-771cca4e1307dcd3.png?imageMogr2/auto-orient/strip%7CimageView2/2" class="imagebubble-image"><br><div class="image-caption">Paste_Image.png</div>
</div>
<p>��װ��ߵ�һ��c/c++�Ĳ����΢��Ĺٷ��������<br>��װ���֮������VSCode��Ч��</p>
<h1>��װg++���롢���Ի���</h1>
<p>Ŀǰwindows�µ��Խ�֧�� Cygwin �� MinGW������ʹ�õ���MinGW.<br><strong><a href="https://sourceforge.net/projects/mingw/files/latest/download?source=files" target="_blank">Download mingw-get-setup.exe (86.5 kB)</a></strong></p>
<p>�������̰�װ����װ��֮��򿪽��棺</p>
<div class="image-package imagebubble" widget="ImageBubble">
<img src="http://upload-images.jianshu.io/upload_images/2419083-3b225e8185a546ac.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240" data-original-src="http://upload-images.jianshu.io/upload_images/2419083-3b225e8185a546ac.png?imageMogr2/auto-orient/strip%7CimageView2/2" class="imagebubble-image"><br><div class="image-caption">Paste_Image.png</div>
</div><p><br>��װ�˴�ѡ�е�ģ�顣ȫѡ��֮�����Ͻ�Installationt-&gt;Apply Changes���а�װ����÷�ǽ����<br><strong><em>Ȼ�����û�������</em></strong><br>�������ⲽ�ͺã��������õĿ����Լ��������价������Ӧ���ǶԳ���Ա����������ǵ����ˣ�<br>��ʱ���޸Ļ���������Ҫ���������</p>
<h1>�޸�VSCode���������ļ�</h1>
<p>��VSCode��һ���ļ��У���ΪVSCode������һ�������ļ������Ա�����һ���ļ��������У�<br>�½�һ��a.cpp<br>дһ����򵥵ĳ���</p>
<div class="image-package imagebubble" widget="ImageBubble">
<img src="http://upload-images.jianshu.io/upload_images/2419083-daca50e608f0ba0a.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240" data-original-src="http://upload-images.jianshu.io/upload_images/2419083-daca50e608f0ba0a.png?imageMogr2/auto-orient/strip%7CimageView2/2" class="imagebubble-image"><br><div class="image-caption">Paste_Image.png</div>
</div><p><br>����ұߵ�֩�룬�ٵ����ߵ������Ϸ������ð�ť��ѡ��c++���뻷������launch.json���ļ������滻�����£�</p>
<p><pre>
```
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "C++ Launch (GDB)",                 // �������ƣ��������������õ������˵�����ʾ
            "type": "cppdbg",                           // �������ͣ�����ֻ��Ϊcppdbg
            "request": "launch",                        // �����������ͣ�����Ϊlaunch����������attach�����ӣ�
            "launchOptionType": "Local",                // �������������ͣ�����ֻ��ΪLocal
            "targetArchitecture": "x86",                // ����Ŀ��ܹ���һ��Ϊx86��x64������Ϊx86, arm, arm64, mips, x64, amd64, x86_64
            "program": "$${file}.exe",                   // ��Ҫ���е��Եĳ����·��
            "miDebuggerPath":"c:\\MinGW\\bin\\gdb.exe", // miDebugger��·����ע������Ҫ��MinGw��·����Ӧ
            "args": ["blackkitty",  "1221", "# #"],     // �������ʱ���ݸ�����������в�����һ����Ϊ�ռ���
            "stopAtEntry": false,                       // ��Ϊtrueʱ������ͣ�ڳ�����ڴ���һ������Ϊfalse
            "cwd": "$${workspaceRoot}",                  // ���Գ���ʱ�Ĺ���Ŀ¼��һ��Ϊ$${workspaceRoot}����������Ŀ¼
            "externalConsole": true,                    // ����ʱ�Ƿ���ʾ����̨���ڣ�һ������Ϊtrue��ʾ����̨
            "preLaunchTask": "g++"����                  // ���ԻỰ��ʼǰִ�е�����һ��Ϊ�������c++Ϊg++, cΪgcc
        }
    ]
}
```
</pre></p>
<p><strong>ע��miDebuggerPathҪ��MinGw��·����Ӧ</strong><br>
<p><br>�滻�󱣴棬Ȼ���л���a.cpp����F5���е��ԣ���ʱ�ᵯ��һ����Ϣ��Ҫ���������������г��򣬵����~<br>ѡ���������г��򣬵��Others������tasks.json�������ļ���<br>�滻�����´���</p>
<pre class="hljs sql"><code class="sql">{
    "version": "<span class="hljs-operator">0.<span class="hljs-number">1.0</span><span class="hljs-string">",
    "</span>command<span class="hljs-string">": "</span><span class="hljs-keyword">g</span>++<span class="hljs-string">",
    "</span>args<span class="hljs-string">": ["</span>-<span class="hljs-keyword">g</span><span class="hljs-string">","</span>${<span class="hljs-keyword">file</span>}<span class="hljs-string">","</span>-o<span class="hljs-string">","</span>${<span class="hljs-keyword">file</span>}.exe<span class="hljs-string">"],    // �����������
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
<p>����һ�£�Ȼ���л���a.cpp���ٴΰ�F5��������</p>
<div class="image-package imagebubble" widget="ImageBubble">
<img src="http://upload-images.jianshu.io/upload_images/2419083-ddfaedfc814c5548.png?imageMogr2/auto-orient/strip%7CimageView2/2/w/1240" data-original-src="http://upload-images.jianshu.io/upload_images/2419083-ddfaedfc814c5548.png?imageMogr2/auto-orient/strip%7CimageView2/2" class="imagebubble-image"><br><div class="image-caption">Paste_Image.png</div>
</div><p><br>Ȼ��Ϳ������öϵ������</p>
</div>