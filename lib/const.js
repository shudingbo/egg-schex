'use strict';

module.exports = {
	STA:{
		RUN   :1,    // 运行
		START :2,
		STOP  :3,
		EXCEPTION:4   // exception
	},
	AddCode:{
		OK:1,  // add OK
		Exist:2, // job exist
		Exception:3  // add Exception
	},
	JobStep:{
		INIT:0,  // 初始化
		RUN:1,   // 运行
		STOP:2   // 停止
	},
	Method:{
		add : 0,  // 添加 job
		start: 1, // 启动 job
		stop : 2, // 停止 job
		rm  : 3,  // 删除 job
		up  : 4,  // 更新 job
		info : 5, // 获取jobinfo
	}
};
