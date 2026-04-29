---
title: Hugo通过命令一键部署
date: 2020-03-20
tags: [折腾]
categories: ["toss"] 



---

###  

我的博客是放在Coding的，不得不说真的很好用，在写上篇文章的时候我还在考虑要不要换到wordpress，但是折腾了几天，发现和Hugo相比较速度太慢了，想想还是算了。其实也有考虑用Gridea，但它文章是储存到本地的，觉得有一点小限制。关于Coding现在有个不足之处就是我在cloudstudio写完文章以后push到Coding比较麻烦，需要输入好几条命令。所以我试了试它的构建与部署功能。

![琛苏设计](https://img.010316.xyz/usr/hugo/2020/03/image-20200320134407465.png)

之前没接触过这个玩意儿，所以首先看了看官方文档，然后百度了半天，试了一下午也没研究通，卡到最后一步成功不了。

![image-20200320134722548](https://img.010316.xyz/usr/hugo/2020/03/image-20200320134722548.png)

所以我换了个思路，既然无法通过构建部署，不如在cloudstudio中直接写个命令程序，运行一下可不可以。百度了一下是可行的。

### 操作方法如下

在hugo目录中新建一个文件夹命名为deploy.sh，文件内容如下：

```sh
# hugo生成
hugo
# cd到构建输出的目录下
cd public
# 初始化仓库
git init
# 添加
git add -A
# 提交
git commit -m deploy
# 强制推送到 cnguu.github.io 仓库的 master 分支
git push -f git@e.coding.net:chen92/chen92.git master
# 结束
cd -
```

也就是这样子的，然后每次在写完文章以后，直接运行 

```sh
bash deploy.sh
```

这样就可以了。

![image-20200320135856653](https://img.010316.xyz/usr/hugo/2020/03/image-20200320135856653.png)

这个是运行记录![image-20200320140601813](https://img.010316.xyz/usr/hugo/2020/03/image-20200320140601813.png)

### 总结

一个命令可以化腐朽为神奇，越来越喜欢程序员这个职业了，可以将许多不可能变为可能。可惜年纪大了，没有时间和精力学习，只能当做个爱好来研究研究。